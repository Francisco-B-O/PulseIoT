# API Reference

Base URL for all Spring endpoints: `http://localhost:8080/api/v1`

All endpoints except auth require `Authorization: Bearer <token>`.

---

## Authentication

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "<ADMIN_PASSWORD from .env>"
}
```
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

### Register
```http
POST /auth/register
Content-Type: application/json

{
  "username": "newuser",
  "password": "securepass123"
}
```

---

## Devices

### List all
```http
GET /devices
Authorization: Bearer {token}
```

### Get by ID
```http
GET /devices/{deviceId}
Authorization: Bearer {token}
```

### Create
```http
POST /devices
Authorization: Bearer {token}
Content-Type: application/json

{
  "deviceId": "sensor-01",
  "type": "TEMPERATURE",
  "simulated": false,
  "latitude": 40.4168,
  "longitude": -3.7038
}
```
`latitude` and `longitude` are optional (nullable). Returns 201 with the created device. Returns 409 if `deviceId` already exists.

### Delete
```http
DELETE /devices/{deviceId}
Authorization: Bearer {token}
```
Returns 204 No Content.

### Toggle simulation
```http
PATCH /devices/{deviceId}/simulate
Authorization: Bearer {token}
Content-Type: application/json

{ "simulated": true }
```

### Update GPS coordinates
```http
PATCH /devices/{deviceId}/location
Authorization: Bearer {token}
Content-Type: application/json

{ "latitude": 41.3888, "longitude": 2.1590 }
```
Pass `null` for both fields to clear GPS. Returns the updated device DTO.

### Lightweight list for map rendering
```http
GET /devices/map
Authorization: Bearer {token}
```
Returns a slim DTO per device: `deviceId`, `type`, `status`, `latitude`, `longitude`, `simulated`, `areaName` (null if not assigned). Avoids N+1 via a JOIN FETCH + in-memory lookup.

---

## Areas

### List all (with device membership)
```http
GET /areas
Authorization: Bearer {token}
```
```json
[
  {
    "id": "uuid",
    "name": "Zone A",
    "polygon": [[40.0, -3.0], [40.1, -3.0], [40.1, -3.1]],
    "deviceCount": 2,
    "deviceIds": ["sensor-01", "sensor-02"]
  }
]
```

### Create
```http
POST /areas
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Zone A",
  "polygon": [[40.0, -3.0], [40.1, -3.0], [40.1, -3.1]]
}
```
`polygon` must have at least 3 points; each point must be exactly `[lat, lng]`. Returns 201.

### Update polygon
```http
PATCH /areas/{id}/polygon
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Zone A",
  "polygon": [[41.0, -4.0], [41.1, -4.0], [41.1, -4.1]]
}
```

### Delete
```http
DELETE /areas/{id}
Authorization: Bearer {token}
```
Returns 204. Cascades to the `area_devices` join table.

### Assign device to area (idempotent)
```http
POST /areas/{areaId}/devices/{deviceId}
Authorization: Bearer {token}
```
Returns the updated area response. If the device is already assigned, returns 200 without duplicating.

---

## Telemetry

### Submit
```http
POST /telemetry
Authorization: Bearer {token}
Content-Type: application/json

{
  "deviceId": "sensor-1",
  "payload": {
    "temperature": 23.5,
    "humidity": 45.2,
    "vibration": 0.02
  }
}
```

---

## Alerts

### List
```http
GET /alerts
Authorization: Bearer {token}
```

Query params: `status` (OPEN, ACKNOWLEDGED, RESOLVED), `severity` (CRITICAL, HIGH, MEDIUM, LOW)

### Get
```http
GET /alerts/{id}
Authorization: Bearer {token}
```

### Acknowledge
```http
PUT /alerts/{id}/acknowledge
Authorization: Bearer {token}
```

---

## Alert Rules

### Get temperature threshold
```http
GET /rules/temperature
Authorization: Bearer {token}
```
```json
100.0
```

### Update temperature threshold
```http
POST /rules/temperature
Authorization: Bearer {token}
Content-Type: application/json

{
  "threshold": 90
}
```

Alert logic: `temp > threshold` → CRITICAL alert (HIGH severity), `temp > threshold * 0.8` → WARNING alert (MEDIUM severity).

---

## Analytics

### Device stats (event count + last seen)
```http
GET /analytics/stats/{deviceId}
Authorization: Bearer {token}
```
```json
{
  "deviceId": "sensor-01",
  "eventCount": 142,
  "lastSeen": 1743850000000
}
```

`lastSeen` is epoch milliseconds. Null if no telemetry has been received yet. The frontend uses a 2-minute window to determine online/offline status.

### Telemetry history (last 50 snapshots)
```http
GET /analytics/history/{deviceId}
Authorization: Bearer {token}
```
```json
[
  {"ts": 1743850000000, "temperature": 24.5, "humidity": 52.0, "vibration": 0.12},
  {"ts": 1743849940000, "temperature": 23.8, "humidity": 51.5, "vibration": 0.10}
]
```

Newest first. Maximum 50 entries per device, stored in Redis.

---

## ML API — port 8000

Interactive docs at `http://localhost:8000/docs`.

### Health
```http
GET http://localhost:8000/health
```
```json
{
  "status": "healthy",
  "model_version": "20260402_161522",
  "threshold": -0.0363
}
```

### Single prediction
```http
POST http://localhost:8000/predict
Content-Type: application/json

{
  "deviceId": "sensor-01",
  "timestamp": "2026-04-03T12:00:00Z",
  "enrichedData": {
    "temperature": 95.0,
    "humidity": 10.0,
    "vibration": 8.0
  }
}
```
```json
{
  "is_anomaly": true,
  "anomaly_score": -0.184,
  "prediction": "ANOMALY",
  "threshold": -0.0363
}
```

### Batch prediction
```http
POST http://localhost:8000/predict/batch
Content-Type: application/json

{
  "deviceId": "sensor-01",
  "events": [
    {"timestamp": "2026-04-03T12:00:00Z", "enrichedData": {"temperature": 23, "humidity": 52, "vibration": 0.1}},
    {"timestamp": "2026-04-03T12:01:00Z", "enrichedData": {"temperature": 24, "humidity": 53, "vibration": 0.12}},
    {"timestamp": "2026-04-03T12:02:00Z", "enrichedData": {"temperature": 95, "humidity": 9,  "vibration": 7.5}}
  ]
}
```

Events must be oldest-first. Returns one result per event.

### Retrain model
```http
POST http://localhost:8000/train
```

### Data lake stats
```http
GET http://localhost:8000/stats
```

### Anomaly statistics
```http
GET http://localhost:8000/anomaly-stats
```
```json
{
  "total_predictions": 320,
  "anomaly_count": 14,
  "anomaly_rate": 4.4,
  "anomalies_by_device": {
    "sensor-01": 9,
    "sensor-02": 5
  },
  "recent_anomalies": [
    {"device_id": "sensor-01", "timestamp": "2026-04-06T10:12:00Z", "is_anomaly": true, "score": -0.184}
  ]
}
```

Stats are computed from an in-memory deque (max 500 entries) and reset on service restart.

### Get auto-retrain config
```http
GET http://localhost:8000/autotrain
```
```json
{
  "enabled": false,
  "interval_hours": 6.0,
  "last_train_time": null
}
```

### Set auto-retrain config
```http
POST http://localhost:8000/autotrain
Content-Type: application/json

{
  "enabled": true,
  "interval_hours": 4.0
}
```
```json
{
  "status": "ok",
  "config": {
    "enabled": true,
    "interval_hours": 4.0
  }
}
```

The background thread checks every minute and triggers retraining when the configured interval has elapsed.

---

## Error codes

| Code | Meaning |
|------|---------|
| 401 | Missing or invalid JWT |
| 403 | Insufficient role |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate user) |
| 429 | Rate limited |
| 500 | Server error |
