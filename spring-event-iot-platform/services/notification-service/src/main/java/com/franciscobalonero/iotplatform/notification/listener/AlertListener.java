package com.franciscobalonero.iotplatform.notification.listener;

import com.franciscobalonero.iotplatform.common.event.AlertCreatedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

/**
 * Kafka listener component responsible for handling alert events for notifications.
 * This listener simulates sending notifications to system administrators when an alert is created.
 *
 * @author Francisco Balonero Olivera
 */
@Component
@Slf4j
public class AlertListener {

    /**
     * Handles an alert created event and logs a simulated notification.
     *
     * @param event The alert event containing severity, device ID, and message.
     */
    @KafkaListener(topics = "alert-created", groupId = "notification-group")
    public void handleAlert(AlertCreatedEvent event) {
        log.info("********** NOTIFICATION SENT **********");
        log.info("To: system-admin@iot-platform.com");
        log.info("Severity: {}", event.getSeverity());
        log.info("Device ID: {}", event.getDeviceId());
        log.info("Message: {}", event.getMessage());
        log.info("Timestamp: {}", event.getTimestamp());
        log.info("***************************************");
    }
}
