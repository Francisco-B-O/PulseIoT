package com.franciscobalonero.iotplatform.common.exception;

import com.franciscobalonero.iotplatform.common.dto.StandardErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.KafkaException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.stream.Collectors;

/**
 * Global exception handler for all Spring Boot microservices.
 * Transforms exceptions into a consistent {@link StandardErrorResponse} format.
 *
 * @author Francisco Balonero Olivera
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    /**
     * Handles custom BaseException and its subclasses.
     *
     * @param ex      The base exception instance.
     * @param request The current web request.
     * @return A response entity with error details.
     */
    @ExceptionHandler(BaseException.class)
    public ResponseEntity<StandardErrorResponse> handleBaseException(BaseException ex, HttpServletRequest request) {
        log.error("Handling BaseException: {}", ex.getMessage());
        return createErrorResponse(ex.getStatus(), ex.getMessage(), request.getRequestURI());
    }

    /**
     * Handles validation errors from @Valid requests.
     *
     * @param ex      The validation exception.
     * @param request The current web request.
     * @return A response entity with aggregated validation messages.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<StandardErrorResponse> handleValidationException(MethodArgumentNotValidException ex, HttpServletRequest request) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.joining(", "));
        log.error("Handling validation exception: {}", message);
        return createErrorResponse(HttpStatus.BAD_REQUEST, message, request.getRequestURI());
    }

    /**
     * Handles Kafka exceptions.
     *
     * @param ex      The Kafka exception.
     * @param request The current web request.
     * @return A response entity with error details.
     */
    @ExceptionHandler(KafkaException.class)
    public ResponseEntity<StandardErrorResponse> handleKafkaException(KafkaException ex, HttpServletRequest request) {
        log.error("Handling KafkaException: {}", ex.getMessage());
        return createErrorResponse(HttpStatus.SERVICE_UNAVAILABLE, "Error communicating with Kafka: " + ex.getMessage(), request.getRequestURI());
    }

    /**
     * Handles all other unexpected runtime exceptions.
     *
     * @param ex      The runtime exception instance.
     * @param request The current web request.
     * @return A response entity with an internal server error status.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<StandardErrorResponse> handleGenericException(Exception ex, HttpServletRequest request) {
        log.error("Handling unexpected exception", ex);
        return createErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred", request.getRequestURI());
    }

    /**
     * Utility method to create a standardized error response.
     *
     * @param status  HTTP status to return.
     * @param message Detail message to include in the body.
     * @param path    The URI path where the error occurred.
     * @return A formatted response entity.
     */
    private ResponseEntity<StandardErrorResponse> createErrorResponse(HttpStatus status, String message, String path) {
        StandardErrorResponse response = StandardErrorResponse.builder()
                .timestamp(LocalDateTime.now())
                .status(status.value())
                .error(status.getReasonPhrase())
                .message(message)
                .path(path)
                .build();
        return new ResponseEntity<>(response, status);
    }
}
