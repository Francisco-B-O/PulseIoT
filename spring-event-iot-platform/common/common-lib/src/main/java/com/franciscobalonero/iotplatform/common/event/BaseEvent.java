package com.franciscobalonero.iotplatform.common.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.time.Instant;
import java.util.UUID;

/**
 * Abstract base class for all events in the IoT platform.
 * Provides common fields such as eventId, timestamp, and sourceService for all events.
 *
 * @author Francisco Balonero Olivera
 */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public abstract class BaseEvent {
    /**
     * Unique identifier for the event.
     */
    private UUID eventId;

    /**
     * Correlation ID for request tracing.
     */
    private String correlationId;

    /**
     * The type of the event (e.g., DeviceTelemetryEvent, AlertCreatedEvent).
     */
    private String eventType;

    /**
     * The version of the event schema.
     */
    @Builder.Default
    private String version = "1.0";

    /**
     * The time when the event was created.
     */
    @Builder.Default
    private Instant timestamp = Instant.now();

    /**
     * The name of the service that generated the event.
     */
    private String sourceService;
}
