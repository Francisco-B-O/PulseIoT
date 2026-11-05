package com.franciscobalonero.iotplatform.device.controller;

import com.franciscobalonero.iotplatform.device.dto.AreaRequest;
import com.franciscobalonero.iotplatform.device.dto.AreaResponse;
import com.franciscobalonero.iotplatform.device.service.AreaService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST controller for managing geographic areas on the IoT map.
 */
@RestController
@RequestMapping("/api/v1/areas")
@RequiredArgsConstructor
@Tag(name = "Area Management", description = "Endpoints for geospatial area management")
public class AreaController {

    private final AreaService areaService;

    @GetMapping
    @Operation(summary = "List all areas", description = "Returns all defined geographic areas with their device membership")
    public List<AreaResponse> getAllAreas() {
        return areaService.getAllAreas();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create area", description = "Creates a new geographic area from a polygon")
    public AreaResponse createArea(@Valid @RequestBody AreaRequest request) {
        return areaService.createArea(request);
    }

    @PatchMapping("/{id}/polygon")
    @Operation(summary = "Update area polygon", description = "Replaces the polygon coordinates of an existing area")
    public AreaResponse updatePolygon(@PathVariable UUID id, @Valid @RequestBody AreaRequest request) {
        return areaService.updatePolygon(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete area", description = "Removes a geographic area")
    public void deleteArea(@PathVariable UUID id) {
        areaService.deleteArea(id);
    }

    @PostMapping("/{id}/devices/{deviceId}")
    @Operation(summary = "Assign device to area", description = "Adds a device to a geographic area")
    public AreaResponse assignDevice(@PathVariable UUID id, @PathVariable String deviceId) {
        return areaService.assignDevice(id, deviceId);
    }
}
