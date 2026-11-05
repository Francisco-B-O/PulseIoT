package com.franciscobalonero.iotplatform.processing.listener;

import com.franciscobalonero.iotplatform.common.event.DeviceTelemetryEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

/**
 * Listener for Dead Letter Topic (DLT) of telemetry events.
 * Handles events that failed all retry attempts.
 *
 * @author Francisco Balonero Olivera
 */
@Component
@Slf4j
public class DeadLetterListener {

    /**
     * Handles events from the DLT topic.
     * Logs the failure for further investigation.
     */
    @KafkaListener(topics = "device-data-received-dlt", groupId = "dlq-monitoring-group")
    public void handleDlt(DeviceTelemetryEvent event,
                          @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
                          @Header(KafkaHeaders.OFFSET) long offset) {
        log.error("EVENT PERMANENTLY FAILED: EventId={}, DeviceId={}, Topic={}, Offset={}",
                event.getEventId(), event.getDeviceId(), topic, offset);
        
        // In a real enterprise system, this could:
        // 1. Save to a "failed_events" table in DB
        // 2. Trigger an alert in a monitoring system
        // 3. Send a notification to an administrator
    }
}
