package com.franciscobalonero.iotplatform.ingestion.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Data Transfer Object for telemetry ingestion requests.
 * Captures raw telemetry data sent by devices.
 *
 * @author Francisco Balonero Olivera
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TelemetryRequest {
    /**
     * Unique identifier for the device sending the telemetry.
     */
    @NotBlank(message = "Device ID is required")
    private String deviceId;
    
    /**
     * Map of telemetry data points (e.g., temperature, humidity).
     */
    @NotEmpty(message = "Payload cannot be empty")
    private Map<String, Object> payload;

    private String eventType;
    private String version;
    private java.time.Instant timestamp;
}
