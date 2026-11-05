package com.franciscobalonero.iotplatform.common.event;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.UUID;

/**
 * Event published when a new alert is created in the system.
 * This class captures the necessary information about the alert to be consumed by other services.
 *
 * @author Francisco Balonero Olivera
 */
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class AlertCreatedEvent extends BaseEvent {
    /**
     * The unique identifier for the alert.
     */
    private UUID alertId;

    /**
     * The unique identifier for the device that triggered the alert.
     */
    private String deviceId;

    /**
     * The severity level of the alert.
     */
    private String severity;

    /**
     * A detailed message explaining the reason for the alert.
     */
    private String message;
}
