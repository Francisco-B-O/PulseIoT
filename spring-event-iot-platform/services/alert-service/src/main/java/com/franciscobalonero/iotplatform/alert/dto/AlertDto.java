package com.franciscobalonero.iotplatform.alert.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Data Transfer Object for Alert information.
 *
 * @author Francisco Balonero Olivera
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AlertDto {
    private UUID id;
    private String deviceId;
    private String severity;
    private String message;
    private LocalDateTime timestamp;
    private boolean acknowledged;
}
