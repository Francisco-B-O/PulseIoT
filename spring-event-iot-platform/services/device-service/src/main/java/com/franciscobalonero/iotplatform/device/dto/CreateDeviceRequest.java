package com.franciscobalonero.iotplatform.device.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Data Transfer Object for creating a new device registration.
 * Captures the essential information required to register a device in the system.
 *
 * @author Francisco Balonero Olivera
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateDeviceRequest {
    /**
     * Unique identifier for the device.
     */
    @NotBlank(message = "Device ID is required")
    private String deviceId;
    
    /**
     * Type of the device (e.g., TEMPERATURE, HUMIDITY).
     */
    @NotBlank(message = "Device type is required")
    private String type;

    /**
     * Whether the device should be simulated (auto-generates telemetry).
     * Defaults to false.
     */
    private boolean simulated;

    /** Optional GPS latitude for map placement. */
    private Double latitude;

    /** Optional GPS longitude for map placement. */
    private Double longitude;
}
