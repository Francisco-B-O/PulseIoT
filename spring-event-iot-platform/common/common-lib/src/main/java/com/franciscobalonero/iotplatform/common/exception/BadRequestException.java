package com.franciscobalonero.iotplatform.common.exception;

import org.springframework.http.HttpStatus;

/**
 * Exception thrown when a request is syntactically valid but semantically wrong
 * (e.g. latitude out of range). Results in an HTTP 400 Bad Request response.
 *
 * @author Francisco Balonero Olivera
 */
public class BadRequestException extends BaseException {

    /**
     * Constructs a BadRequestException with the specified message.
     *
     * @param message The detailed error message.
     */
    public BadRequestException(String message) {
        super(HttpStatus.BAD_REQUEST, message);
    }
}
