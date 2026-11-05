# System Design & Microservice Specification

## 1. Gateway Service (gateway-service)
- **Role**: API Gateway & Router.
- **Port**: 8080.
- **Technology**: Spring Cloud Gateway.
- **Key Responsibilities**:
    - Centralized entry point for all API calls.
    - Dynamic routing to downstream services based on path (e.g., `/api/v1/devices/**`).
    - Cross-cutting concerns like Rate Limiting and JWT validation.

## 2. Discovery Service (discovery-service)
- **Role**: Service Registry.
- **Port**: 8761.
- **Technology**: Netflix Eureka.
- **Key Responsibilities**:
    - Maintains a registry of all active microservices.
    - Enables service-to-service communication via hostnames instead of static IPs.

## 3. Device Service (device-service)
- **Role**: Device Registry & Metadata Manager.
- **Port**: 8081.
- **Storage**: PostgreSQL (`iot_platform` database).
- **API Endpoints**:
    - `GET /api/v1/devices`: List all registered devices.
    - `POST /api/v1/devices`: Register a new device.
    - `GET /api/v1/devices/{deviceId}`: Get device metadata.
    - `DELETE /api/v1/devices/{deviceId}`: De-register a device.

## 4. Ingestion Service (ingestion-service)
- **Role**: High-Throughput Telemetry Receiver.
- **Port**: 8082.
- **Technology**: Spring Web, Kafka Producer.
- **API Endpoints**:
    - `POST /api/v1/telemetry`: Ingest raw telemetry.
- **Kafka Topics**:
    - Produces to `device-data-received`.

## 5. Processing Service (processing-service)
- **Role**: Business Logic & Data Enrichment.
- **Port**: 8083.
- **Kafka Topics**:
    - Consumes from `device-data-received`.
    - Produces to `device-data-processed`.
- **Logic**: Fetches metadata from the Device Service to enrich telemetry events and determine status (NORMAL, WARNING, CRITICAL).

## 6. Alert Service (alert-service)
- **Role**: Anomaly Persistence & Alert Trigger.
- **Port**: 8084.
- **Storage**: PostgreSQL.
- **Kafka Topics**:
    - Consumes from `device-data-processed`.
    - Produces to `alert-created`.
- **Logic**: If status is `CRITICAL`, create an alert record and notify.

## 7. Analytics Service (analytics-service)
- **Role**: Real-time Aggregator & Stats Provider.
- **Port**: 8085.
- **Storage**: Redis.
- **Kafka Topics**:
    - Consumes from `device-data-received`.
- **API Endpoints**:
    - `GET /api/v1/analytics/stats/{deviceId}`: Get real-time event counts.

## 8. Notification Service (notification-service)
- **Role**: Alert Dispatcher.
- **Port**: 8086.
- **Kafka Topics**:
    - Consumes from `alert-created`.
- **Logic**: Simulates sending high-priority messages to external users or systems.
