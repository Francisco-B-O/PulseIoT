package com.franciscobalonero.iotplatform.processing.client;

import lombok.Data;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.Optional;

/**
 * Feign client for communicating with the Device Service.
 * Provides methods to retrieve device metadata and status.
 *
 * @author Francisco Balonero Olivera
 */
@FeignClient(name = "device-service")
public interface DeviceClient {

    /**
     * Retrieves device details from the Device Service by its unique identifier.
     *
     * @param deviceId The unique identifier of the device.
     * @return An optional containing the device response if found.
     */
    @GetMapping("/api/v1/devices/{deviceId}")
    Optional<DeviceResponse> getDeviceById(@PathVariable("deviceId") String deviceId);

    /**
     * Data Transfer Object representing the device response from the Device Service.
     */
    @Data
    class DeviceResponse {
        private String deviceId;
        private String type;
        private String status;
    }
}
