package com.franciscobalonero.iotplatform.device.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Response DTO for a geographic area, including its polygon and assigned devices.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AreaResponse {

    private UUID id;
    private String name;

    /** Ordered list of [latitude, longitude] coordinate pairs. */
    private List<List<Double>> polygon;

    private LocalDateTime createdAt;

    /** Number of devices currently assigned to this area. */
    private int deviceCount;

    /** Business device IDs of all devices in this area. */
    private List<String> deviceIds;
}
