package com.franciscobalonero.iotplatform.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Exception thrown when a resource conflict occurs in the system (e.g., entity already exists).
 * Results in an HTTP 409 Conflict response.
 *
 * @author Francisco Balonero Olivera
 */
public class ConflictException extends BaseException {

    /**
     * Constructs a ConflictException with the specified message.
     *
     * @param message The detailed error message.
     */
    public ConflictException(String message) {
        super(HttpStatus.CONFLICT, message);
    }
}
