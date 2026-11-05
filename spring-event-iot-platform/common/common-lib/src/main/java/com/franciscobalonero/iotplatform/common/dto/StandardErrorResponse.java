package com.franciscobalonero.iotplatform.common.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Data Transfer Object representing a standard error response in the system.
 * This class captures details about errors encountered during request processing.
 *
 * @author Francisco Balonero Olivera
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StandardErrorResponse {
    /**
     * The timestamp when the error occurred.
     */
    private LocalDateTime timestamp;

    /**
     * The HTTP status code of the error.
     */
    private int status;

    /**
     * The error type or title.
     */
    private String error;

    /**
     * A detailed error message.
     */
    private String message;

    /**
     * The request path where the error occurred.
     */
    private String path;
}
