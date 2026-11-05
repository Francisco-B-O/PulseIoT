# Deployment

## Local (Docker Compose)

### Requirements

- Docker + Docker Compose
- ~6 GB RAM
- Ports free: `8080`, `4200`, `8000`, `8761`, `3000`, `9090`, `9411`

### Start

```bash
docker compose build --no-cache
docker compose up -d
```

Check everything is up:

```bash
docker compose ps
curl http://localhost:8761/eureka/apps   # all services should appear here
```

### Environment variables

Defaults in `docker-compose.yml` work out of the box for local dev. For a real deployment, override at minimum:

| Variable | Used by | Description |
|----------|---------|-------------|
| `JWT_SECRET` | auth-service, gateway-service | Must be the same in both, ≥ 256 bits |
| `SPRING_DATASOURCE_PASSWORD` | auth-service, device-service, processing-service, alert-service | PostgreSQL password |
| `KAFKA_BOOTSTRAP_SERVERS` | all Spring services, ml-platform | Internal: `kafka:29092` |
| `ANOMALY_THRESHOLD` | iot-ml-platform | Override ML detection threshold |

Generate a secure JWT secret:

```bash
openssl rand -base64 32
```

### Useful commands

```bash
# Follow logs for a service
docker compose logs -f processing-service

# Restart a single service
docker compose restart iot-ml-platform

# Stop everything
docker compose down

# Stop and delete volumes (full reset)
docker compose down -v
```

### Database backup

```bash
docker exec postgres pg_dump -U postgres iot_platform > backup.sql

# Restore
docker exec -i postgres psql -U postgres iot_platform < backup.sql
```

### ML data lake backup

```bash
docker cp iot-ml-platform:/app/data/raw ./backup_data_lake/
```

---

## Monitoring

| Tool | URL | Credentials |
|------|-----|-------------|
| Grafana | http://localhost:3000 | admin / admin |
| Prometheus | http://localhost:9090 | — |
| Zipkin | http://localhost:9411 | — |
| Eureka | http://localhost:8761 | — |

Prometheus scrapes `/actuator/prometheus` from every Spring service every 15 seconds. Config: `infrastructure/monitoring/prometheus.yml`.

---

## Notes for production

The current setup runs everything on a single Docker host via Compose. For a real deployment you'd want to:

- Put the gateway behind a reverse proxy (nginx/Traefik) for TLS termination
- Move PostgreSQL and Kafka out of Compose into managed services
- Set `SPRING_DATASOURCE_PASSWORD` and `JWT_SECRET` via secrets management, not plain env vars
- The Prometheus config uses `host.docker.internal` which only works on Docker Desktop — change to actual hostnames on Linux servers
