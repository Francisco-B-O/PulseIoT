package com.franciscobalonero.iotplatform.analytics.controller;

import com.franciscobalonero.iotplatform.analytics.dto.AnalyticsDto;
import com.franciscobalonero.iotplatform.analytics.service.AnalyticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * REST controller for retrieving device analytics stats and telemetry history.
 *
 * @author Francisco Balonero Olivera
 */
@RestController
@RequestMapping("/api/v1/analytics")
@RequiredArgsConstructor
@Tag(name = "Analytics Management", description = "Endpoints for retrieving device analytics statistics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    /**
     * Retrieves event count and last-seen timestamp for a specific device.
     */
    @GetMapping("/stats/{deviceId}")
    @Operation(summary = "Get device stats", description = "Retrieves event count and last-seen timestamp for a specific IoT device")
    public AnalyticsDto getStats(@PathVariable String deviceId) {
        return analyticsService.getDeviceStats(deviceId);
    }

    /**
     * Returns the last 50 telemetry snapshots for a device (newest first).
     * Each entry contains ts (epoch ms), temperature, humidity, vibration.
     */
    @GetMapping("/history/{deviceId}")
    @Operation(summary = "Get device telemetry history", description = "Returns the last 50 telemetry readings for a device")
    public List<Map<String, Object>> getHistory(@PathVariable String deviceId) {
        return analyticsService.getDeviceHistory(deviceId);
    }
}
