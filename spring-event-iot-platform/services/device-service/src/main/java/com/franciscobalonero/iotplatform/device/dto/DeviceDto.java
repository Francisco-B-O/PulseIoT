package com.franciscobalonero.iotplatform.device.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Data Transfer Object representing device details.
 * Used for exposing device information through the REST API.
 *
 * @author Francisco Balonero Olivera
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceDto {
    /**
     * Internal unique identifier (UUID).
     */
    private UUID id;

    /**
     * Business unique identifier for the device.
     */
    private String deviceId;

    /**
     * The type of the device.
     */
    private String type;

    /**
     * The current status of the device registration (e.g., ACTIVE, INACTIVE).
     */
    private String status;

    /**
     * The timestamp when the device was registered.
     */
    private LocalDateTime createdAt;

    /**
     * Whether this device is being simulated (auto-generates telemetry).
     */
    private boolean simulated;

    /** GPS latitude (nullable — device may not have a fixed location). */
    private Double latitude;

    /** GPS longitude (nullable). */
    private Double longitude;
}
