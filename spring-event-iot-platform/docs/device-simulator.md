# Device Simulator

The `device-simulator` is a utility component designed to generate synthetic telemetry data for testing and demonstration purposes. It mimics the behavior of physical IoT devices by sending periodic telemetry updates to the platform.

## How it Works

The simulator is implemented as a standalone Spring Boot application that runs alongside the microservices. It contains a scheduled task that:
1.  **Selects a random device ID** from a predefined list (e.g., `sensor-1`, `sensor-2`, etc.).
2.  **Generates random sensor readings** for temperature (20°C to 50°C) and humidity (30% to 80%).
3.  **Constructs a JSON payload** for the `ingestion-service`.
4.  **Dispatches the data** via an HTTP POST request to the Gateway Service.

## Configuration

The simulator's behavior can be customized using environment variables in `docker-compose.yml`:

- `SIMULATOR_GATEWAY_URL`: The base URL of the Gateway Service (defaults to `http://gateway-service:8080`).
- `SIMULATOR_INTERVAL`: The delay between telemetry emissions in milliseconds (defaults to `5000`).

## Monitoring the Simulator

To view the simulator's logs and see telemetry being generated:

```bash
docker logs -f device-simulator
```

**Example output:**
```text
2024-03-16 10:05:01 INFO  TelemetrySimulator - Simulator: Sending telemetry for sensor-1 - Temp: 24.52C
2024-03-16 10:05:06 INFO  TelemetrySimulator - Simulator: Sending telemetry for sensor-3 - Temp: 42.10C
```

## Simulating Anomalies

Because the temperature is generated randomly between 20°C and 50°C, and the platform's critical threshold is 40°C, the simulator will naturally produce "CRITICAL" events approximately 33% of the time. This allows you to verify the alerting and notification flow without any manual intervention.

## Disabling the Simulator

If you wish to test the platform manually and don't want the noise of the simulator:

```bash
docker stop device-simulator
```
Or comment out the `device-simulator` section in `docker-compose.yml` before starting the platform.
