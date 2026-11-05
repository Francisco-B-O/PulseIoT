# Deployment Guide

This document provides step-by-step instructions for deploying the `spring-event-iot-platform` on your local environment or server.

## Prerequisites

Before starting, ensure you have the following installed:
- **Docker** and **Docker Compose**
- **Java 21 JDK** (for manual compilation)
- **Maven 3.9+** (for building service artifacts)

## Step 1: Clone the Repository

```bash
git clone https://github.com/franciscobalonero/spring-event-iot-platform.git
cd spring-event-iot-platform
```

## Step 2: Build the Services

We use Maven to build the executable JAR files for each microservice.

```bash
mvn clean package -DskipTests
```
This command generates the JAR artifacts in the `target/` directory of each service module.

## Step 3: Deploy the Infrastructure

The entire platform, including infrastructure and services, is orchestrated via a single `docker-compose.yml` file.

```bash
docker compose up -d
```

This will start the following components:

### Infrastructure Components:
- **zookeeper**: Zookeeper instance for Kafka coordination.
- **kafka**: Apache Kafka broker for event streaming.
- **postgres**: Relational database (Port 5432) for device and alert storage.
- **redis**: In-memory data store (Port 6379) for real-time analytics.
- **zipkin**: Distributed tracing server (Port 9411).
- **prometheus**: Monitoring and metrics collection (Port 9090).
- **grafana**: Dashboard visualization (Port 3000).

### Platform Services:
- **discovery-service**: Eureka Service Registry (Port 8761).
- **gateway-service**: API Gateway (Port 8080).
- **device-service**: Device metadata management (Port 8081).
- **ingestion-service**: Telemetry intake (Port 8082).
- **processing-service**: Data enrichment (Port 8083).
- **alert-service**: Alert detection (Port 8084).
- **analytics-service**: Real-time stats (Port 8085).
- **notification-service**: Event dispatcher (Port 8086).
- **device-simulator**: Automated telemetry generator.

## Step 4: Verification

1.  **Eureka Dashboard**: Open [http://localhost:8761](http://localhost:8761) to verify all services are registered and "UP".
2.  **Zipkin**: Check [http://localhost:9411](http://localhost:9411) to see distributed traces.
3.  **Prometheus**: Access [http://localhost:9090](http://localhost:9090) to query system metrics.
4.  **Grafana**: Login to [http://localhost:3000](http://localhost:3000) (User: `admin`, Password: `admin`).

## Service Port Mappings

| Service | Host Port | Internal Port |
| :--- | :--- | :--- |
| Gateway Service | 8080 | 8080 |
| Device Service | 8081 | 8081 |
| Ingestion Service | 8082 | 8082 |
| Processing Service | 8083 | 8083 |
| Alert Service | 8084 | 8084 |
| Analytics Service | 8085 | 8085 |
| Notification Service | 8086 | 8086 |
| Discovery Service | 8761 | 8761 |
| Kafka Broker | 9092 | 29092 |
| PostgreSQL | 5432 | 5432 |
| Redis | 6379 | 6379 |
| Zipkin | 9411 | 9411 |
| Prometheus | 9090 | 9090 |
| Grafana | 3000 | 3000 |

## Stopping the Platform

To shut down and remove all containers:

```bash
docker compose down
```
To also remove volumes (including database data):
```bash
docker compose down -v
```
