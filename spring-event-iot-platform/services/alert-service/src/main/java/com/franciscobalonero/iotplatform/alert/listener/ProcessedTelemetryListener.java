package com.franciscobalonero.iotplatform.alert.listener;

import com.franciscobalonero.iotplatform.alert.model.Alert;
import com.franciscobalonero.iotplatform.alert.model.IdempotencyRecord;
import com.franciscobalonero.iotplatform.alert.repository.IdempotencyRecordRepository;
import com.franciscobalonero.iotplatform.alert.repository.AlertRepository;
import com.franciscobalonero.iotplatform.common.event.AlertCreatedEvent;
import com.franciscobalonero.iotplatform.common.event.ProcessedTelemetryEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Kafka listener component responsible for processing enriched telemetry events.
 * This listener monitors telemetry status and triggers the creation of alerts for critical conditions.
 *
 * @author Francisco Balonero Olivera
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ProcessedTelemetryListener {

    private final AlertRepository alertRepository;
    private final IdempotencyRecordRepository idempotencyRecordRepository;
    private final KafkaTemplate<String, AlertCreatedEvent> kafkaTemplate;

    private static final String ALERT_TOPIC      = "alert-created";
    private static final String STATUS_CRITICAL  = "CRITICAL";
    private static final String STATUS_WARNING   = "WARNING";
    private static final String SEVERITY_HIGH    = "HIGH";
    private static final String SEVERITY_MEDIUM  = "MEDIUM";

    /**
     * Handles processed telemetry events received from Kafka.
     * Creates and publishes an {@link AlertCreatedEvent} for CRITICAL and WARNING statuses.
     *
     * @param event The processed telemetry event containing device ID, status, and enriched data.
     */
    @KafkaListener(topics = "device-data-processed", groupId = "alert-group")
    @Transactional
    public void handleProcessedTelemetry(ProcessedTelemetryEvent event) {
        log.info("Checking for alerts in telemetry from device: {}", event.getDeviceId());

        // Kafka delivers at-least-once: skip events we have already turned into an alert.
        UUID eventId = event.getEventId();
        if (eventId != null && idempotencyRecordRepository.existsById(eventId)) {
            log.warn("Duplicate processed event {} detected. Skipping.", eventId);
            return;
        }

        String severity = resolveSeverity(event.getStatus());
        if (severity == null) {
            return;
        }

        String message = buildAlertMessage(event);
        log.warn("{} status detected for device: {}. Creating {} alert.", event.getStatus(), event.getDeviceId(), severity);

        Alert savedAlert = alertRepository.save(Alert.builder()
                .deviceId(event.getDeviceId())
                .severity(severity)
                .message(message)
                .timestamp(LocalDateTime.now(ZoneOffset.UTC))
                .acknowledged(false)
                .build());

        // Same transaction as the alert insert: either both are committed or neither.
        if (eventId != null) {
            idempotencyRecordRepository.save(IdempotencyRecord.builder()
                    .eventId(eventId)
                    .processedAt(Instant.now())
                    .build());
        }

        AlertCreatedEvent alertEvent = AlertCreatedEvent.builder()
                .eventId(UUID.randomUUID())
                .correlationId(event.getCorrelationId())
                .eventType("AlertCreatedEvent")
                .timestamp(Instant.now())
                .sourceService("alert-service")
                .alertId(savedAlert.getId())
                .deviceId(savedAlert.getDeviceId())
                .severity(savedAlert.getSeverity())
                .message(savedAlert.getMessage())
                .build();

        kafkaTemplate.send(ALERT_TOPIC, alertEvent.getDeviceId(), alertEvent);
        log.info("Alert created and published: {} (severity: {})", alertEvent.getAlertId(), severity);
    }

    /**
     * Maps a telemetry processing status to an alert severity.
     *
     * @param status The telemetry status string (e.g. "CRITICAL", "WARNING").
     * @return The corresponding alert severity, or {@code null} if no alert should be raised.
     */
    private String resolveSeverity(String status) {
        if (STATUS_CRITICAL.equals(status)) return SEVERITY_HIGH;
        if (STATUS_WARNING.equals(status))  return SEVERITY_MEDIUM;
        return null;
    }

    private String buildAlertMessage(ProcessedTelemetryEvent event) {
        return String.format("%s condition detected for device %s. Data: %s",
                event.getStatus(), event.getDeviceId(), event.getEnrichedData());
    }
}
