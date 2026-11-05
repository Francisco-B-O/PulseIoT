# Usage Guide

The `spring-event-iot-platform` provides several REST APIs for managing devices and ingesting telemetry. All external calls should go through the **Gateway Service** at `localhost:8080`.

## 1. Device Registration (device-service)

Before a device can send telemetry, it must be registered in the system.

### Create a Device
- **Endpoint**: `POST /api/v1/devices`
- **Payload**:
    ```json
    {
      "deviceId": "sensor-123",
      "type": "THERMOMETER"
    }
    ```
- **Example (cURL)**:
    ```bash
    curl -X POST http://localhost:8080/api/v1/devices \
         -H "Content-Type: application/json" \
         -d '{"deviceId": "sensor-123", "type": "THERMOMETER"}'
    ```

### List All Devices
- **Endpoint**: `GET /api/v1/devices`
- **Example (cURL)**:
    ```bash
    curl http://localhost:8080/api/v1/devices
    ```

## 2. Telemetry Ingestion (ingestion-service)

Telemetry data is the lifeblood of the platform.

### Send Telemetry
- **Endpoint**: `POST /api/v1/telemetry`
- **Payload**:
    ```json
    {
      "deviceId": "sensor-123",
      "payload": {
        "temperature": 25.5,
        "humidity": 60.0
      }
    }
    ```
- **Example (cURL)**:
    ```bash
    curl -X POST http://localhost:8080/api/v1/telemetry \
         -H "Content-Type: application/json" \
         -d '{"deviceId": "sensor-123", "payload": {"temperature": 25.5, "humidity": 60.0}}'
    ```

## 3. Real-time Analytics (analytics-service)

The Analytics Service provides aggregated stats retrieved directly from Redis.

### Get Event Count and Last Seen for a Device
- **Endpoint**: `GET /api/v1/analytics/stats/{deviceId}`
- **Example (cURL)**:
    ```bash
    curl -H "Authorization: Bearer $TOKEN" \
         http://localhost:8080/api/v1/analytics/stats/sensor-123
    ```
- **Response**:
    ```json
    {
      "deviceId": "sensor-123",
      "eventCount": 42,
      "lastSeen": 1743850000000
    }
    ```

`lastSeen` is epoch milliseconds. Null if no telemetry received. The frontend uses a 2-minute window to derive the Online/Offline badge.

### Get Telemetry History for a Device
- **Endpoint**: `GET /api/v1/analytics/history/{deviceId}`
- **Example (cURL)**:
    ```bash
    curl -H "Authorization: Bearer $TOKEN" \
         http://localhost:8080/api/v1/analytics/history/sensor-123
    ```
- **Response** (newest first, max 50 entries):
    ```json
    [
      {"ts": 1743850000000, "temperature": 24.5, "humidity": 52.0, "vibration": 0.12},
      {"ts": 1743849940000, "temperature": 23.8, "humidity": 51.5, "vibration": 0.10}
    ]
    ```

## 4. Anomaly Detection and Alerts (alert-service)

The Alert Service manages alerts generated based on processed telemetry data.

### List All Alerts
- **Endpoint**: `GET /api/v1/alerts`
- **Example (cURL)**:
    ```bash
    curl http://localhost:8080/api/v1/alerts
    ```

### Acknowledge an Alert
- **Endpoint**: `PUT /api/v1/alerts/{id}/acknowledge`
- **Example (cURL)**:
    ```bash
    curl -X PUT http://localhost:8080/api/v1/alerts/550e8400-e29b-41d4-a716-446655440000/acknowledge
    ```

## 5. Processing Rules (processing-service)

The Processing Service allows dynamic updates to its business rules.

### Get Current Temperature Threshold
- **Endpoint**: `GET /api/v1/rules/temperature`
- **Example (cURL)**:
    ```bash
    curl http://localhost:8080/api/v1/rules/temperature
    ```

### Update Temperature Threshold
- **Endpoint**: `POST /api/v1/rules/temperature`
- **Payload**:
    ```json
    {
      "threshold": 45.0
    }
    ```
- **Example (cURL)**:
    ```bash
    curl -X POST http://localhost:8080/api/v1/rules/temperature \
         -H "Content-Type: application/json" \
         -d '{"threshold": 45.0}'
    ```

## 🌐 Interactive API Documentation (Swagger UI)

Each service provides interactive API documentation via Swagger UI. You can access it directly or through the Gateway (if configured).

- **Gateway**: [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
- **Device Service**: [http://localhost:8081/swagger-ui.html](http://localhost:8081/swagger-ui.html)
- **Ingestion Service**: [http://localhost:8082/swagger-ui.html](http://localhost:8082/swagger-ui.html)
- **Processing Service**: [http://localhost:8083/swagger-ui.html](http://localhost:8083/swagger-ui.html)
- **Alert Service**: [http://localhost:8084/swagger-ui.html](http://localhost:8084/swagger-ui.html)
- **Analytics Service**: [http://localhost:8085/swagger-ui.html](http://localhost:8085/swagger-ui.html)

## Tips for Testing
- Use the **Device Simulator** to automatically generate telemetry data.
- Use tools like **Postman** or **Insomnia** to interact with the API Gateway.
- Use the **Zipkin Dashboard** ([http://localhost:9411](http://localhost:9411)) to follow the journey of a single telemetry request across all services.
