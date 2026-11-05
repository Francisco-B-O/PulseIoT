package com.franciscobalonero.iotplatform.device.controller;

import com.franciscobalonero.iotplatform.device.dto.CreateDeviceRequest;
import com.franciscobalonero.iotplatform.device.dto.DeviceDto;
import com.franciscobalonero.iotplatform.device.dto.DeviceMapDto;
import com.franciscobalonero.iotplatform.device.service.DeviceService;
import com.franciscobalonero.iotplatform.common.exception.ResourceNotFoundException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

import java.util.List;

/**
 * REST controller for managing device metadata.
 * Provides endpoints for creating, retrieving, and deleting IoT device registrations.
 *
 * @author Francisco Balonero Olivera
 */
@RestController
@RequestMapping("/api/v1/devices")
@RequiredArgsConstructor
@Tag(name = "Device Management", description = "Endpoints for managing IoT devices")
public class DeviceController {

    private final DeviceService deviceService;

    /**
     * Retrieves a list of all registered devices.
     *
     * @return A list of device data transfer objects.
     */
    @GetMapping
    @Operation(summary = "Get all devices", description = "Retrieves a list of all registered IoT devices")
    public List<DeviceDto> getAllDevices() {
        return deviceService.getAllDevices();
    }

    @GetMapping("/map")
    @Operation(summary = "Get devices for map", description = "Returns lightweight device data with GPS coordinates for map rendering")
    public List<DeviceMapDto> getDevicesForMap() {
        return deviceService.getDevicesForMap();
    }

    /**
     * Retrieves a specific device by its unique device identifier.
     *
     * @param deviceId The unique identifier for the device.
     * @return The device data transfer object.
     * @throws ResourceNotFoundException if the device is not found.
     */
    @GetMapping("/{deviceId}")
    @Operation(summary = "Get device by ID", description = "Retrieves a specific device by its unique identifier")
    public DeviceDto getDeviceById(@PathVariable String deviceId) {
        return deviceService.getDeviceById(deviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Device with ID " + deviceId + " not found"));
    }

    /**
     * Creates a new device registration.
     *
     * @param request The request containing device ID and type.
     * @return The created device DTO.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create device", description = "Registers a new IoT device in the system")
    public DeviceDto createDevice(@Valid @RequestBody CreateDeviceRequest request) {
        return deviceService.createDevice(request);
    }

    /**
     * Deletes a device registration by its unique identifier.
     *
     * @param deviceId The unique identifier for the device to delete.
     */
    @DeleteMapping("/{deviceId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete device", description = "Removes a device registration from the system")
    public void deleteDevice(@PathVariable String deviceId) {
        deviceService.deleteDevice(deviceId);
    }

    /**
     * Enables or disables simulation for a device.
     *
     * @param deviceId The unique identifier for the device.
     * @param body     Map with a boolean "simulated" field.
     * @return The updated device DTO.
     */
    @PatchMapping("/{deviceId}/simulate")
    @Operation(summary = "Toggle device simulation", description = "Enable or disable telemetry simulation for a device")
    public DeviceDto setSimulated(@PathVariable String deviceId,
                                  @RequestBody Map<String, Boolean> body) {
        boolean simulated = Boolean.TRUE.equals(body.get("simulated"));
        return deviceService.setSimulated(deviceId, simulated);
    }

    @PatchMapping("/{deviceId}/location")
    @Operation(summary = "Set device GPS coordinates", description = "Updates or clears the latitude/longitude of a device")
    public DeviceDto updateLocation(@PathVariable String deviceId,
                                    @RequestBody Map<String, Double> body) {
        return deviceService.updateLocation(deviceId, body.get("latitude"), body.get("longitude"));
    }
}
