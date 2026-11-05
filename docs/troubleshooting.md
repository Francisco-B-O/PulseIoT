# Troubleshooting

## Services won't start

```bash
# See what's wrong
docker compose logs <service-name>

# Check all containers
docker compose ps

# Port already in use — find and kill the process
lsof -i :8080
```

Common cause: services start before their dependencies are ready. Eureka, Kafka, and PostgreSQL need to be healthy first. Wait ~30 seconds and retry, or restart the failing service:

```bash
docker compose restart <service-name>
```

---

## Can't log in

```bash
# Verify the gateway is up
curl http://localhost:8080/actuator/health

# Try login directly
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}'
```

If you get a `WeakKeyException` in the auth-service logs, the `JWT_SECRET` is too short. Generate a proper one:

```bash
openssl rand -base64 32
```

Set it in `docker-compose.yml` under both `auth-service` and `gateway-service` environment variables.

---

## Services can't find each other

```bash
# Check Eureka — all services should be listed
curl http://localhost:8761/eureka/apps

# Check Docker network
docker network inspect prueba_iot-network
```

Services resolve each other by name (e.g. `http://device-service/`) via Eureka. If a service isn't registered it won't receive traffic.

---

## No data / alerts not appearing

Data flows: `device-simulator → ingestion → Kafka → processing → alert-service`

Check each step:

```bash
docker compose logs device-simulator
docker compose logs ingestion-service
docker compose logs processing-service
docker compose logs alert-service
```

Check Kafka topics exist:

```bash
docker exec kafka kafka-topics --list --bootstrap-server localhost:9092
```

Check consumer lag:

```bash
docker exec kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group processing-group \
  --describe
```

---

## ML platform issues

```bash
docker compose logs iot-ml-platform
```

Check the API is up:

```bash
curl http://localhost:8000/health
```

The model loads from `ml/models/latest_model.json`. If the file is missing or the model directory is empty, the platform starts but predictions return `(false, 0.0)`. Retrain:

```bash
curl -X POST http://localhost:8000/train
```

Test a prediction manually:

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "sensor-01",
    "timestamp": "2026-04-03T12:00:00Z",
    "enrichedData": {"temperature": 95.0, "humidity": 10.0, "vibration": 8.0}
  }'
```

---

## Database issues

```bash
# Check PostgreSQL is running
docker compose ps postgres

# Connect and inspect
docker exec -it postgres psql -U postgres -d iot_platform

# Inside psql
\dt          -- list tables
SELECT * FROM alerts LIMIT 5;
```

Tables are created automatically on startup via `spring.jpa.hibernate.ddl-auto: update`. If tables are missing, check the service logs for JPA errors.

---

## Frontend not loading

```bash
docker compose logs frontend
curl -I http://localhost:4200
```

If the page loads but shows no data, the frontend can't reach the gateway. Check the API URL in `frontend/src/environments/environment.ts` — it's built dynamically from `window.location.hostname`, so it should point to `localhost:8080` automatically in local dev.

---

## General health check

```bash
# All containers
docker compose ps

# Resource usage
docker stats --no-stream

# PostgreSQL
docker exec postgres psql -U postgres -c "SELECT 1"

# Kafka
docker exec kafka kafka-topics --list --bootstrap-server localhost:9092

# ML API
curl http://localhost:8000/health

# Gateway
curl http://localhost:8080/actuator/health
```

## `password authentication failed for user "postgres"` after changing `.env`

`POSTGRES_PASSWORD` is only applied when the Postgres data directory is created. If `infrastructure/docker/postgres-data/` already exists from an earlier run, either keep the old password in `.env` or reset it:

```bash
# keep the data, change the password in place
docker compose exec postgres psql -U postgres -c "ALTER USER postgres PASSWORD 'new-password';"
# or start from scratch (deletes all data)
docker compose down && rm -rf infrastructure/docker/postgres-data
```
