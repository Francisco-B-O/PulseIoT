package com.franciscobalonero.iotplatform.common.event;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.Map;

/**
 * Event representing telemetry data received from a device.
 * It contains the device identifier and the raw telemetry payload.
 *
 * @author Francisco Balonero Olivera
 */
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceTelemetryEvent extends BaseEvent {
    /**
     * Unique identifier for the device sending the telemetry.
     */
    private String deviceId;

    /**
     * The raw telemetry data as a map of key-value pairs.
     */
    private Map<String, Object> payload;
}
