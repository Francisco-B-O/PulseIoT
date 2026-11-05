package com.franciscobalonero.iotplatform.common.event;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.Map;
import java.util.UUID;

/**
 * Event representing telemetry data that has been processed and enriched.
 * This class includes the original event ID, device ID, enriched data, and its analysis status.
 *
 * @author Francisco Balonero Olivera
 */
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class ProcessedTelemetryEvent extends BaseEvent {
    /**
     * The UUID of the original DeviceTelemetryEvent that triggered this processing.
     */
    private UUID originalEventId;

    /**
     * Unique identifier for the device that sent the original telemetry.
     */
    private String deviceId;

    /**
     * The processed and enriched telemetry data.
     */
    private Map<String, Object> enrichedData;

    /**
     * The status determined after processing (e.g., NORMAL, WARNING, CRITICAL).
     */
    private String status; // NORMAL, WARNING, CRITICAL
}
