package com.franciscobalonero.iotplatform.processing.listener;

import com.franciscobalonero.iotplatform.common.event.DeviceTelemetryEvent;
import com.franciscobalonero.iotplatform.common.event.ProcessedTelemetryEvent;
import com.franciscobalonero.iotplatform.processing.client.DeviceClient;
import com.franciscobalonero.iotplatform.processing.service.RuleService;
import com.franciscobalonero.iotplatform.processing.model.IdempotencyRecord;
import com.franciscobalonero.iotplatform.processing.repository.IdempotencyRecordRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Kafka listener component responsible for processing raw telemetry events.
 * It enriches telemetry data with device metadata and determines the status based on business rules.
 *
 * @author Francisco Balonero Olivera
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TelemetryListener {

    private final DeviceClient deviceClient;
    private final RuleService ruleService;
    private final IdempotencyRecordRepository idempotencyRecordRepository;
    private final KafkaTemplate<String, ProcessedTelemetryEvent> kafkaTemplate;

    private static final String OUTPUT_TOPIC    = "device-data-processed";
    private static final String STATUS_NORMAL   = "NORMAL";
    private static final String STATUS_WARNING  = "WARNING";
    private static final String STATUS_CRITICAL = "CRITICAL";

    /**
     * Handles raw telemetry events received from Kafka.
     * Enriches the event data by calling the Device Service and publishes a {@link ProcessedTelemetryEvent}.
     *
     * @param event The raw device telemetry event.
     */
    @KafkaListener(topics = "device-data-received", groupId = "processing-group")
    @Transactional
    public void handleTelemetry(DeviceTelemetryEvent event) {
        // Set Correlation ID for structured logging
        MDC.put("correlationId", event.getCorrelationId());
        
        try {
            log.info("Processing telemetry for device: {}", event.getDeviceId());

            // 1. Idempotency Check
            if (idempotencyRecordRepository.existsById(event.getEventId())) {
                log.warn("Duplicate event detected: {}. Skipping.", event.getEventId());
                return;
            }

            // 2. Fetch metadata (validation)
            var deviceResponse = deviceClient.getDeviceById(event.getDeviceId());
            if (deviceResponse.isEmpty()) {
                log.warn("Device {} not found in registry. Skipping processing.", event.getDeviceId());
                return;
            }

            // 3. Business Logic: Enrichment & Status Determination
            Map<String, Object> enrichedData = new HashMap<>(event.getPayload());
            enrichedData.put("deviceType", deviceResponse.get().getType());

            String status = determineStatus(event.getPayload(), event.getDeviceId());

            // 4. Create & Publish Processed Event
            ProcessedTelemetryEvent processedEvent = ProcessedTelemetryEvent.builder()
                    .eventId(UUID.randomUUID())
                    .correlationId(event.getCorrelationId())
                    .eventType("ProcessedTelemetryEvent")
                    .version("1.0")
                    .originalEventId(event.getEventId())
                    .timestamp(Instant.now())
                    .sourceService("processing-service")
                    .deviceId(event.getDeviceId())
                    .enrichedData(enrichedData)
                    .status(status)
                    .build();

            // 5. Claim the event BEFORE publishing: if the insert collides with a concurrent
            //    redelivery we skip, and if the publish fails the transaction rolls the claim back.
            try {
                idempotencyRecordRepository.saveAndFlush(IdempotencyRecord.builder()
                        .eventId(event.getEventId())
                        .processedAt(Instant.now())
                        .build());
            } catch (DataIntegrityViolationException duplicate) {
                log.warn("Event {} was claimed concurrently. Skipping.", event.getEventId());
                return;
            }

            kafkaTemplate.send(OUTPUT_TOPIC, processedEvent.getDeviceId(), processedEvent);

            log.debug("Processed event published: {} with status {}", processedEvent.getEventId(), status);
        } finally {
            MDC.clear();
        }
    }

    /**
     * Determines the processing status based on the temperature value in the payload
     * relative to the configured threshold.
     *
     * @param payload  The raw telemetry payload map.
     * @param deviceId The device identifier, used only for warning logs.
     * @return {@code "CRITICAL"}, {@code "WARNING"}, or {@code "NORMAL"}.
     */
    private String determineStatus(Map<String, Object> payload, String deviceId) {
        Object tempVal = payload.get("temperature");
        if (!(tempVal instanceof Number)) {
            if (tempVal != null) {
                log.warn("temperature payload value is not a Number for device {}: {}", deviceId, tempVal);
            }
            return STATUS_NORMAL;
        }
        double temp  = ((Number) tempVal).doubleValue();
        double limit = ruleService.getTemperatureThreshold();
        if (temp > limit)        return STATUS_CRITICAL;
        if (temp > limit * 0.8)  return STATUS_WARNING;
        return STATUS_NORMAL;
    }
}
