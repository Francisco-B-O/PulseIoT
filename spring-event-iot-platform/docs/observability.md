# Observability & Monitoring

The `spring-event-iot-platform` is designed with deep observability in mind, incorporating monitoring, metrics, and distributed tracing to provide a clear view of the system's performance and behavior.

## Monitoring Stack

The platform integrates the following tools:
- **Prometheus**: A time-series database for metrics collection.
- **Grafana**: A visualization tool for creating real-time dashboards.
- **Zipkin**: A distributed tracing system to track requests across microservices.
- **Micrometer Tracing**: The library used to generate and propagate trace context.

## 1. Metrics with Prometheus

Each microservice exposes an endpoint at `/actuator/prometheus` containing JVM, HTTP, and Kafka metrics.

### Accessing Prometheus
- **URL**: [http://localhost:9090](http://localhost:9090)
- **Common Queries**:
    - `http_server_requests_seconds_count`: Total number of HTTP requests.
    - `kafka_producer_record_send_total`: Total number of Kafka messages produced.
    - `jvm_memory_used_bytes`: Current JVM memory usage.

Prometheus is configured to scrape all microservices every 15 seconds.

## 2. Visualization with Grafana

Grafana provides a user-friendly way to visualize the metrics collected by Prometheus.

### Accessing Grafana
- **URL**: [http://localhost:3000](http://localhost:3000)
- **Username**: `admin`
- **Password**: `admin`

### Configuration
1.  **Add Data Source**: Select "Prometheus" and set the URL to `http://prometheus:9090`.
2.  **Import Dashboards**: You can import standard Spring Boot dashboards (e.g., ID: 11378 for JVM metrics).

## 3. Distributed Tracing with Zipkin

Distributed tracing allows you to follow a single request as it travels through multiple services. This is particularly useful for diagnosing latency issues or failures in an asynchronous, event-driven system.

### Accessing Zipkin
- **URL**: [http://localhost:9411](http://localhost:9411)

### How it Works
When a telemetry request enters the `ingestion-service`, a unique `traceId` is generated. This ID is then:
1.  **Propagated in HTTP Headers** to the `discovery-service` and `gateway-service`.
2.  **Included in Kafka Message Headers** as the event travels from `ingestion-service` to `processing-service` and beyond.
3.  **Captured by Zipkin**, allowing you to see the entire "span" of a request from end to end.

## 4. Health Checks

Every service exposes a health check endpoint via Spring Boot Actuator.

- **Endpoint**: `http://localhost:<port>/actuator/health`
- **Format**: JSON
- **Status**: Returns `{"status": "UP"}` if the service and its dependencies (DB, Kafka, Redis) are healthy.

You can also monitor the status of all services centrally via the **Discovery Service (Eureka)** dashboard at [http://localhost:8761](http://localhost:8761).
