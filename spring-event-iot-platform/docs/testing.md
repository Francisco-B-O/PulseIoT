# Testing Documentation

The `spring-event-iot-platform` employs a multi-layered testing strategy to ensure the reliability and correctness of its microservices, including unit tests for business logic and integration tests for data persistence.

## Testing Stack

- **JUnit 5**: The primary testing framework.
- **Mockito**: For mocking external dependencies (e.g., Feign clients, Kafka templates) in unit tests.
- **AssertJ**: For fluent and expressive assertions.
- **Spring Boot Test**: For context-aware testing.
- **H2 Database**: An in-memory database used for `@DataJpaTest` to verify repository logic without requiring a full PostgreSQL instance.

## Testing Strategy

### 1. Unit Tests (Mocking)
Unit tests focus on the business logic within services and listeners. We use `Mockito` to isolate the component under test.

- **Example**: `TelemetryListenerTest` in the Processing Service verifies that raw telemetry is correctly enriched and that the status (NORMAL/CRITICAL) is calculated accurately based on sensor values.

### 2. Persistence Tests (@DataJpaTest)
These tests verify the interaction between the application and the database.

- **Example**: `DeviceRepositoryTest` in the Device Service ensures that device entities are correctly persisted, queried, and deleted in the PostgreSQL schema (simulated via H2).

### 3. API Controller Tests (@WebMvcTest)
These tests verify that REST endpoints are correctly mapped and that input validation works as expected.

- **Example**: `IngestionControllerTest` verifies that the `/api/v1/telemetry` endpoint accepts valid JSON payloads and returns the correct HTTP status codes.

## Running Tests

### Run All Tests
To execute all tests across all modules from the project root:

```bash
mvn test
```

### Run Tests for a Specific Service
To run tests for a single microservice (e.g., `device-service`):

```bash
mvn test -pl services/device-service
```

## Continuous Integration
In a CI/CD pipeline, tests are executed automatically on every pull request. A build is only considered successful if all tests pass.

## Future Scope: Integration Testing with Testcontainers
While current tests use H2 and Mockito, the next phase of development includes implementing end-to-end integration tests using **Testcontainers**. This will allow running tests against real instances of:
- **Apache Kafka**: To verify end-to-end event propagation.
- **PostgreSQL**: To verify complex database queries and migrations (Flyway/Liquibase).
- **Redis**: To verify real-time analytics aggregation.
