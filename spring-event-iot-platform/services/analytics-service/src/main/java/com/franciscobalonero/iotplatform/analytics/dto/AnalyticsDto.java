package com.franciscobalonero.iotplatform.analytics.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Data Transfer Object for Analytics statistics.
 *
 * @author Francisco Balonero Olivera
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalyticsDto {
    private String deviceId;
    private long eventCount;
    private Long lastSeen; // epoch millis, null if never seen
}
