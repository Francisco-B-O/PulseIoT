# Postman Collection

API collection for the IoT Telemetry Platform — 50+ pre-built requests covering all endpoints.

## Import

1. Open Postman → Import
2. Add `IoT-Platform-Collection.json`
3. Add `IoT-Platform-Environment.json`
4. Select **IoT Platform - Development** environment (top-right dropdown)

## Quick start

1. Run **1. AUTH → Login User** — the JWT token is automatically saved to `{{token}}`
2. All requests under DEVICES, ALERTS, ALERT RULES, and ANALYTICS use `Authorization: Bearer {{token}}`
3. ML API requests (section 7) hit port 8000 directly — no auth needed

## Collection structure

```
1. AUTH              — login, register
2. DEVICES           — CRUD operations
3. TELEMETRY         — send normal / warning / critical readings
4. ALERTS            — list, get by ID, acknowledge
5. ALERT RULES       — GET and POST temperature threshold (runtime config)
6. ANALYTICS         — device stats (event count + last seen), telemetry history
7. ML API            — predict (single + batch), train, stats, anomaly-stats, autotrain
8. HEALTH            — gateway, discovery, ML health checks, Prometheus, Eureka registry
9. EXAMPLE WORKFLOWS — step-by-step end-to-end scenarios
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `base_url` | `http://localhost:8080` | API Gateway — all Spring endpoints |
| `ml_url` | `http://localhost:8000` | ML FastAPI service |
| `token` | auto-populated on login | JWT Bearer token |
| `alert_id` | — | Set manually after fetching alerts |

## Prerequisites

All Docker services must be running:

```bash
docker compose up -d
curl http://localhost:8080/actuator/health
curl http://localhost:8000/health
```

## Key endpoints summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/auth/login` | — | Obtain JWT |
| GET | `/api/v1/devices` | JWT | List devices |
| POST | `/api/v1/telemetry` | JWT | Send sensor reading |
| GET | `/api/v1/alerts` | JWT | List alerts |
| GET | `/api/v1/rules/temperature` | JWT | Get threshold |
| POST | `/api/v1/rules/temperature` | JWT | Update threshold |
| GET | `/api/v1/analytics/stats/{id}` | JWT | Event count + last seen |
| GET | `/api/v1/analytics/history/{id}` | JWT | Last 50 telemetry snapshots |
| POST | `:8000/predict` | — | Score single event |
| POST | `:8000/predict/batch` | — | Score event sequence |
| POST | `:8000/train` | — | Retrain model |
| GET | `:8000/anomaly-stats` | — | Aggregated anomaly stats |
| GET | `:8000/autotrain` | — | Auto-retrain config |
| POST | `:8000/autotrain` | — | Update auto-retrain config |
