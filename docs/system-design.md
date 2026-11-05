# System Design

## Configuration strategy

All hardcoded values are replaced with `${VAR_NAME:default}` in Spring `application.yml` files. Defaults work out of the box for the Docker Compose setup. Override via `.env` or shell environment for other environments.

Python services use `pydantic-settings` / environment variable defaults in `iot-ml-platform/config/`.

The only values that **must** be changed for production:
- `JWT_SECRET` — must be identical in `auth-service` and `gateway-service`, minimum 256 bits
- `SPRING_DATASOURCE_PASSWORD` — PostgreSQL password
- `ANOMALY_THRESHOLD` — optional ML detection sensitivity override

---

## Service discovery

All Spring services register with Eureka at `http://discovery-service:8761/eureka/` on startup. The gateway resolves downstream services by their registered application name (e.g. `lb://ingestion-service`). No hardcoded IPs.

Startup dependency: Eureka, Kafka, and PostgreSQL must be ready before dependent services register successfully. The Compose `depends_on` + healthcheck configuration handles this; services retry independently if dependencies aren't ready yet.

---

## Authentication and authorization

**JWT HS256.** Token issued by `auth-service`, validated by `gateway-service` on every request.

Gateway permit-list (no token required):
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `/actuator/**`

Everything else requires a valid `Authorization: Bearer <token>` header. The gateway rejects invalid or expired tokens with 401 before the request reaches any downstream service.

Role-based access: Spring Security `ROLE_ADMIN` is required for sensitive operations (e.g. model training endpoint). The default `admin` user has this role.

---

## Database design

Three services use PostgreSQL (shared container, separate schemas/tables):

**auth-service** — `users` table: id, username, password (BCrypt hashed), roles.

**device-service** — three tables:
- `devices`: id (UUID), deviceId (string, unique), type (enum), status, createdAt, **latitude** (DOUBLE PRECISION, nullable), **longitude** (DOUBLE PRECISION, nullable), simulated (boolean)
- `areas`: id (UUID), name (VARCHAR), polygon (TEXT — JSON array of `[lat,lng]` pairs serialised by `PolygonConverter`), createdAt
- `area_devices` (join table): area_id → areas(id) ON DELETE CASCADE, device_id → devices(id) ON DELETE CASCADE; PRIMARY KEY (area_id, device_id)

**processing-service** — two tables:
- `processed_events`: eventId (UUID, PK), processedAt (Instant) — idempotency records to avoid double-processing
- `rules`: id (Long, PK), ruleName, metric, threshold (double), description — runtime-configurable alert thresholds

**alert-service** — `alerts` table: id, deviceId, severity (CRITICAL/HIGH/MEDIUM/LOW), message, timestamp, acknowledged (boolean).

Schema creation: `spring.jpa.hibernate.ddl-auto: update`. No Flyway or Liquibase. Tables are created on first startup and updated if entities change.

---

## ML model design

**Algorithm:** Isolation Forest (scikit-learn, `n_estimators=100`, `contamination='auto'`, `random_state=42`)

**Features (24 total):** Raw sensor values (temperature, humidity, vibration) + per-device rolling statistics over a 5-event window: mean, std, min, max, delta — computed separately for each sensor.

**Threshold:** 5th percentile of `decision_function` scores on training data (~-0.036). Stored in `ml/models/latest_model.json` under `metrics.threshold`. Reloaded automatically when the model is loaded — no hardcoded constant.

**Windowed inference:** Single-event prediction fetches the last 4 events for the device from the Parquet data lake before scoring, producing a proper 5-event window. Without this, rolling features degenerate (std=0, delta=0) and the model scores every event as anomalous.

**Model versioning:** Each training run saves to `ml/models/YYYYMMDD_HHMMSS/` and updates `ml/models/latest_model.json` (symlink-like pointer). A registry file tracks all versions.

**Training data limit:** Up to 10,000 records from the Parquet data lake, used as-is without train/test split (unsupervised).

---

## Kafka design

Internal broker address: `kafka:29092` (Docker network). External: `localhost:9092`.

Topics are created automatically by producers on first publish. No explicit partition/replication configuration — defaults (1 partition, replication factor 1) are used, appropriate for single-broker local setup.

Consumer group IDs:
- `processing-group` — processing-service
- `alert-group` — alert-service
- `analytics-group` — analytics-service
- `iot-ml-platform-group` — ML Kafka consumer

The ML consumer implements retry logic: 30 subscription attempts with 2-second backoff, allowing Kafka to be slow to start without failing the container.

---

## Analytics (Redis)

The `analytics-service` maintains three Redis keys per device:

| Key pattern | Type | Value |
|-------------|------|-------|
| `analytics:event-count:{deviceId}` | String | Cumulative telemetry event count (integer) |
| `analytics:last-seen:{deviceId}` | String | Epoch ms of last telemetry received |
| `analytics:history:{deviceId}` | List (max 50) | JSON snapshots `{ts, temperature, humidity, vibration}`, newest first |

Counters are cumulative since service start (or Redis restart). The `lastSeen` field is used by the frontend to derive online/offline status (threshold: last seen within 2 minutes).

---

## Frontend API contract

The Angular app resolves API URLs dynamically from `window.location.hostname`:
- Gateway: `<protocol>//<hostname>:8080/api/v1`
- ML API: `<protocol>//<hostname>:8000`

This means the frontend works without rebuilding when accessed from different hosts (e.g. a remote Docker host IP instead of localhost), as long as ports 8080 and 8000 are reachable from the browser.

---

## Distributed tracing

All Spring services are instrumented with Micrometer and export spans to Zipkin (`http://zipkin:9411`). Trace IDs propagate across service calls via HTTP headers, allowing end-to-end request tracing through: gateway → ingestion → processing → alert/analytics.

The Python ML platform does not emit Zipkin spans.

---

## Known limitations

- Single Kafka broker — no replication or durability guarantees
- `ddl-auto: update` — safe for development, not for production schema changes
- No circuit breakers (Resilience4j) on inter-service calls
- No TLS — add nginx/Traefik with TLS termination in front of the gateway for production
- Prometheus config uses `host.docker.internal` — change to actual hostnames on Linux servers
