# Platform Architecture

## Overview

IoT Telemetry Platform — a distributed system built with Spring Boot microservices, Apache Spark, a Python ML platform, and an Angular frontend.

## Data Pipeline

```
Device Simulator
      │  JWT-authenticated POST /api/v1/telemetry
      ▼
API Gateway (8080)
      │
      ▼
Ingestion Service ──► Kafka: device-data-received
                                    │
                          ┌─────────┴─────────┐
                          ▼                   ▼
              Processing Service       Analytics Service
              (alert rules)            (Redis: stats, history)
                    │
                    ▼
            Kafka: device-data-processed
                    │
              ┌─────┴──────────────────┐
              ▼                        ▼
        Alert Service        Spark Streaming Service
        (PostgreSQL)         (rolling window features)
              │                        │
              ▼                        ▼
        Kafka: alert-created   Kafka: device-data-enriched
              │                        │
              ▼                        ▼
        Notification Service   ML Platform (Python)
                               (Ensemble: IF + Z-score + Trend)
                                        │
                                        ▼
                               Kafka: ml-predictions
                                        │
                               Frontend (polling /api/v1/...)
```

## Services

| Service | Port | Technology | Role |
|---------|------|------------|------|
| gateway-service | 8080 | Spring Cloud Gateway | JWT validation, routing |
| discovery-service | 8761 | Eureka | Service registry |
| auth-service | 8088 | Spring Boot | JWT issuance, user management |
| ingestion-service | 8082 | Spring Boot + Kafka | Receive telemetry |
| processing-service | 8083 | Spring Boot + Kafka | Alert rule evaluation |
| alert-service | 8084 | Spring Boot + Kafka | Alert persistence (PostgreSQL) |
| analytics-service | 8085 | Spring Boot + Redis | Per-device stats & history |
| notification-service | 8086 | Spring Boot + Kafka | Alert fan-out |
| device-service | 8081 | Spring Boot | Device CRUD (PostgreSQL) |
| spark-streaming-service | — | PySpark 3.5 | Rolling window feature engineering |
| iot-ml-platform | 8000 | FastAPI + scikit-learn | Multi-model anomaly detection |
| frontend | 4200 | Angular 17 | Dashboard UI |

## Kafka Topics

| Topic | Producer | Consumers |
|-------|----------|-----------|
| `device-data-received` | ingestion-service | processing-service, analytics-service |
| `device-data-processed` | processing-service | alert-service, spark-streaming-service |
| `device-data-enriched` | spark-streaming-service | iot-ml-platform |
| `alert-created` | alert-service | notification-service |
| `ml-predictions` | iot-ml-platform | (frontend polling via REST) |
| `ml-anomalies` | iot-ml-platform | — |

## Infrastructure

- **Kafka** + Zookeeper (Confluent 7.5)
- **PostgreSQL 16** — auth, device, processing, alert services
- **Redis 7** — analytics service (counters, last-seen, history)
- **Zipkin** — distributed tracing (Micrometer)
- **Prometheus + Grafana** — metrics (scrapes /actuator/prometheus)

## Spark Streaming Service

Separates feature engineering from ML inference:

- **Input**: `device-data-processed` topic
- **Processing**: rolling window of 20 readings per device using `DeviceWindowState`
- **Computed features**: `temp_mean`, `temp_std`, `temp_min`, `temp_max`, `temp_range`, `hum_mean`, `hum_std`, `vib_mean`, `vib_std`, `event_count`, `trend`
- **Output**: enriched JSON on `device-data-enriched` with original payload + `sparkFeatures` object

The business logic lives in `streaming/features.py` (pure Python, no Spark dependency) for testability in CI without Java.

## Security

- JWT HS256 signed by auth-service, validated by gateway for all routes except `/api/v1/auth/**`
- Internal services communicate over Docker bridge network using `expose` (no host ports)
- Role-based access controlled at gateway level
