package com.franciscobalonero.iotplatform.common.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;

/**
 * Base exception class for all custom exceptions in the IoT platform.
 * Provides a common structure for error reporting including status and timestamp.
 *
 * @author Francisco Balonero Olivera
 */
@Getter
public abstract class BaseException extends RuntimeException {
    /**
     * The HTTP status code associated with the exception.
     */
    private final HttpStatus status;

    /**
     * The timestamp when the exception was created.
     */
    private final LocalDateTime timestamp;

    /**
     * Constructs a new BaseException with the specified status and message.
     *
     * @param status  The HTTP status code.
     * @param message The detailed error message.
     */
    protected BaseException(HttpStatus status, String message) {
        super(message);
        this.status = status;
        this.timestamp = LocalDateTime.now();
    }
}
