package com.franciscobalonero.iotplatform.ingestion.service;

import com.franciscobalonero.iotplatform.common.event.DeviceTelemetryEvent;
import com.franciscobalonero.iotplatform.ingestion.dto.TelemetryRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

/**
 * Service class responsible for processing incoming telemetry.
 * Converts telemetry requests into Kafka events and publishes them to the "device-data-received" topic.
 *
 * @author Francisco Balonero Olivera
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class IngestionService {

    private final KafkaTemplate<String, DeviceTelemetryEvent> kafkaTemplate;
    private static final String TOPIC = "device-data-received";

    /**
     * Processes a telemetry request by creating a {@link DeviceTelemetryEvent} and sending it to Kafka.
     *
     * @param request The telemetry request to process.
     */
    public void processTelemetry(TelemetryRequest request) {
        String correlationId = UUID.randomUUID().toString();
        MDC.put("correlationId", correlationId);
        
        try {
            log.info("Ingesting telemetry for device: {}", request.getDeviceId());

            DeviceTelemetryEvent event = DeviceTelemetryEvent.builder()
                    .eventId(UUID.randomUUID())
                    .correlationId(correlationId)
                    .eventType(request.getEventType() != null ? request.getEventType() : "DeviceTelemetryEvent")
                    .version(request.getVersion() != null ? request.getVersion() : "1.0")
                    .timestamp(request.getTimestamp() != null ? request.getTimestamp() : Instant.now())
                    .sourceService("ingestion-service")
                    .deviceId(request.getDeviceId())
                    .payload(request.getPayload())
                    .build();

            kafkaTemplate.send(TOPIC, event.getDeviceId(), event);
            log.debug("Event sent to Kafka: {}", event.getEventId());
        } finally {
            MDC.clear();
        }
    }
}
