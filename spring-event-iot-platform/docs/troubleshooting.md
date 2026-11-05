# Troubleshooting Guide

This document lists common issues and their potential solutions when deploying or using the `spring-event-iot-platform`.

## 1. Docker & Infrastructure Issues

### Issue: Containers keep restarting or fail to start
- **Cause**: Port conflicts or insufficient system resources (e.g., Docker Desktop memory limit).
- **Check**: Run `docker ps -a` to see the status of all containers.
- **Solution**:
    - Ensure ports `8080-8086`, `5432`, `6379`, `9092`, `9411`, `9090`, `3000` are free on your host.
    - Check container logs: `docker logs <container-name>`.
    - Increase memory allocated to Docker Desktop (at least 4GB).

### Issue: Kafka connection failed
- **Cause**: Kafka broker is still initializing or networking configuration is incorrect.
- **Check**: Look for `Connection to node -1 could not be established` in the logs of microservices.
- **Solution**:
    - Ensure `zookeeper` and `kafka` containers are running.
    - Wait 30-60 seconds after running `docker compose up` for the broker to become fully active.

## 2. Service & Networking Issues

### Issue: Services not registering with Eureka
- **Cause**: Networking issues between containers or `discovery-service` hasn't started yet.
- **Check**: Open the Eureka dashboard at [http://localhost:8761](http://localhost:8761).
- **Solution**:
    - Restart the `discovery-service`: `docker restart discovery-service`.
    - Verify that all services are on the same Docker network.

### Issue: HTTP 404 or 503 errors at the Gateway
- **Cause**: Gateway Service hasn't yet discovered the destination service or the route is misconfigured.
- **Check**: Check the logs of `gateway-service`.
- **Solution**:
    - Wait a minute for Eureka registration and routing tables to sync.
    - Confirm the service is "UP" in the Eureka dashboard.

## 3. Database Issues

### Issue: PostgreSQL connection rejected
- **Cause**: Database is still initializing or credentials don't match.
- **Check**: `docker logs postgres`.
- **Solution**:
    - Ensure the credentials in `application.yml` match those in `docker-compose.yml` (`POSTGRES_USER`, `POSTGRES_PASSWORD`).
    - Verify the database `iot_platform` exists.

### Issue: Analytics stats not showing
- **Cause**: Redis connection issue or no telemetry has been processed yet.
- **Check**: `docker logs analytics-service`.
- **Solution**:
    - Ensure the `redis` container is running.
    - Send a manual telemetry request to `ingestion-service`.

## 4. Useful Debugging Commands

| Task | Command |
| :--- | :--- |
| **Follow Logs** | `docker compose logs -f <service-name>` |
| **Check Resource Usage** | `docker stats` |
| **Inspect Network** | `docker network inspect <network-name>` |
| **Reset Database** | `docker compose down -v` (CAUTION: deletes all data) |
| **Force Rebuild** | `docker compose build --no-cache` |

## Still having trouble?
If you're unable to resolve your issue, please check the GitHub Issues page or open a new issue with the following information:
1.  Operating system and Docker version.
2.  Logs from the failing service (`docker logs`).
3.  Output of `docker ps`.
