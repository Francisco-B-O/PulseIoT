package com.franciscobalonero.iotplatform.device.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Lightweight DTO used by the map endpoint.
 * Contains only the fields needed to render a device marker on the map.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceMapDto {

    private String deviceId;
    private String type;
    private String status;
    private Double latitude;
    private Double longitude;
    private boolean simulated;

    /**
     * Name of the area this device belongs to, or {@code null} if unassigned.
     * When a device belongs to multiple areas the first match is returned.
     */
    private String areaName;
}
