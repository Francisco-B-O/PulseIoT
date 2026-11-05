# Event Flow & Kafka Integration

The `spring-event-iot-platform` is built on a robust event-driven architecture using **Apache Kafka** to facilitate asynchronous communication and ensure high throughput.

## Event Definitions

### 1. `DeviceTelemetryEvent`
- **Topic**: `device-data-received`
- **Producer**: Ingestion Service
- **Consumers**: Processing Service, Analytics Service
- **Purpose**: Captures the raw telemetry as sent by the device/simulator.
- **Example Payload**:
  ```json
  {
    "eventId": "b3f1a2c3-d4e5-4f6a-8b9c-0d1e2f3a4b5c",
    "deviceId": "sensor-123",
    "timestamp": "2024-03-16T10:00:00Z",
    "sourceService": "ingestion-service",
    "payload": {
      "temperature": 25.5,
      "humidity": 60.0
    }
  }
  ```

### 2. `ProcessedTelemetryEvent`
- **Topic**: `device-data-processed`
- **Producer**: Processing Service
- **Consumers**: Alert Service, Analytics Service, ML Platform
- **Purpose**: Enriched telemetry event that includes metadata and a calculated status.
- **Example Payload**:
  ```json
  {
    "eventId": "c4a2b3d1-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    "originalEventId": "b3f1a2c3-d4e5-4f6a-8b9c-0d1e2f3a4b5c",
    "deviceId": "sensor-123",
    "timestamp": "2024-03-16T10:00:01Z",
    "status": "NORMAL",
    "enrichedData": {
      "temperature": 25.5,
      "humidity": 60.0,
      "deviceType": "THERMOMETER"
    }
  }
  ```

### 3. `AlertCreatedEvent`
- **Topic**: `alert-created`
- **Producer**: Alert Service
- **Consumers**: Notification Service
- **Purpose**: Event indicating that a critical condition was detected.
- **Example Payload**:
  ```json
  {
    "alertId": "d5b3c4e2-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
    "deviceId": "sensor-123",
    "severity": "HIGH",
    "message": "Critical telemetry received for device sensor-123. Data: {temperature=45.2, ...}",
    "timestamp": "2024-03-16T10:00:02Z"
  }
  ```

## Event Propagation Flow

1.  **Device / Simulator**: Sends a POST request to the Gateway with JSON telemetry.
2.  **Ingestion Service**: Converts the JSON to a `DeviceTelemetryEvent` and publishes it to `device-data-received`.
3.  **Processing Service**:
    -   Consumes the event from `device-data-received`.
    -   Calls Device Service (via Feign/Eureka) to validate the `deviceId` and get metadata.
    -   Enriches the event with `deviceType`.
    -   Evaluates the configurable temperature threshold (default 100°C, stored in PostgreSQL):
        -   `temp > threshold` → status `CRITICAL`
        -   `temp > threshold * 0.8` → status `WARNING`
        -   Otherwise → status `NORMAL`
    -   Idempotency check: skips duplicate event IDs.
    -   Publishes `ProcessedTelemetryEvent` to `device-data-processed`.
4.  **Analytics Service**: Consumes from `device-data-received` in parallel. For each event:
    -   Increments the event counter in Redis (`analytics:event-count:{deviceId}`).
    -   Updates last-seen timestamp (`analytics:last-seen:{deviceId}`).
    -   Pushes a telemetry snapshot to a Redis ring-buffer (`analytics:history:{deviceId}`, capped at 50).
5.  **Alert Service**:
    -   Consumes from `device-data-processed`.
    -   If status is `CRITICAL` → creates a HIGH severity `Alert` entity in PostgreSQL.
    -   If status is `WARNING` → creates a MEDIUM severity `Alert` entity.
    -   Publishes an `AlertCreatedEvent` to `alert-created`.
6.  **ML Platform** (Python): Consumes from `device-data-processed`, scores each event with the Isolation Forest model, and publishes predictions to `ml-predictions` / `ml-anomalies`.
7.  **Notification Service**: Consumes from `alert-created` and delivers notifications (simulated).
