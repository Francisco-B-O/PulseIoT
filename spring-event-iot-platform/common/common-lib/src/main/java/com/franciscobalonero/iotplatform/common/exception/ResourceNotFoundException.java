package com.franciscobalonero.iotplatform.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Exception thrown when a requested resource is not found in the system.
 * Results in an HTTP 404 Not Found response.
 *
 * @author Francisco Balonero Olivera
 */
public class ResourceNotFoundException extends BaseException {

    /**
     * Constructs a ResourceNotFoundException with the specified message.
     *
     * @param message The detailed error message.
     */
    public ResourceNotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, message);
    }
}
