package com.franciscobalonero.iotplatform.processing.controller;

import com.franciscobalonero.iotplatform.processing.service.RuleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for managing processing rules and thresholds.
 *
 * @author Francisco Balonero Olivera
 */
@RestController
@RequestMapping("/api/v1/rules")
@RequiredArgsConstructor
@Tag(name = "Rule Management", description = "Endpoints for managing telemetry processing rules")
public class RuleController {

    private final RuleService ruleService;

    /**
     * Updates the temperature threshold value.
     *
     * @param request The request containing the new threshold value.
     */
    @PostMapping("/temperature")
    @Operation(summary = "Update temperature threshold", description = "Sets a new value for the temperature anomaly detection threshold")
    public void updateThreshold(@RequestBody ThresholdRequest request) {
        ruleService.updateTemperatureThreshold(request.threshold());
    }

    /**
     * Retrieves the current temperature threshold.
     *
     * @return The current temperature threshold value.
     */
    @GetMapping("/temperature")
    @Operation(summary = "Get temperature threshold", description = "Retrieves the current temperature anomaly detection threshold")
    public double getThreshold() {
        return ruleService.getTemperatureThreshold();
    }
}
