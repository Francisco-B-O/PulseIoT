package com.franciscobalonero.iotplatform.ingestion.controller;

import com.franciscobalonero.iotplatform.ingestion.dto.TelemetryRequest;
import com.franciscobalonero.iotplatform.ingestion.service.IngestionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

/**
 * REST controller for ingesting telemetry data from devices.
 * Forwards telemetry requests to the ingestion service for processing.
 *
 * @author Francisco Balonero Olivera
 */
@RestController
@RequestMapping("/api/v1/telemetry")
@RequiredArgsConstructor
@Tag(name = "Telemetry Ingestion", description = "Endpoints for receiving device telemetry data")
public class IngestionController {

    private final IngestionService ingestionService;

    /**
     * Receives telemetry data from a device.
     *
     * @param request The telemetry request containing device ID and payload.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "Ingest telemetry", description = "Receives telemetry data from an IoT device and publishes it for processing")
    public void ingestTelemetry(@Valid @RequestBody TelemetryRequest request) {
        ingestionService.processTelemetry(request);
    }
}
