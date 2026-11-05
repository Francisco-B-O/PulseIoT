package com.franciscobalonero.iotplatform.simulator;

import lombok.Data;
import java.util.Map;

/**
 * Data Transfer Object for sending telemetry data from simulated devices.
 *
 * @author Francisco Balonero Olivera
 */
@Data
public class TelemetryRequest {
    /**
     * Unique identifier for the simulated device.
     */
    private String deviceId;

    /**
     * Payload containing sensor readings and metadata.
     */
    private Map<String, Object> payload;
}
