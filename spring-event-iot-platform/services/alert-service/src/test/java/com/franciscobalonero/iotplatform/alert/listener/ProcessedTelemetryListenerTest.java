package com.franciscobalonero.iotplatform.alert.listener;

import com.franciscobalonero.iotplatform.alert.model.Alert;
import com.franciscobalonero.iotplatform.alert.repository.AlertRepository;
import com.franciscobalonero.iotplatform.alert.repository.IdempotencyRecordRepository;
import com.franciscobalonero.iotplatform.common.event.AlertCreatedEvent;
import com.franciscobalonero.iotplatform.common.event.ProcessedTelemetryEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link ProcessedTelemetryListener}.
 * This class verifies the behavior of the telemetry listener in response to different event statuses.
 *
 * @author Francisco Balonero Olivera
 */
@ExtendWith(MockitoExtension.class)
class ProcessedTelemetryListenerTest {

    @Mock
    private AlertRepository alertRepository;

    @Mock
    private IdempotencyRecordRepository idempotencyRecordRepository;

    @Mock
    private KafkaTemplate<String, AlertCreatedEvent> kafkaTemplate;

    @InjectMocks
    private ProcessedTelemetryListener listener;

    /**
     * Verifies that an alert is created and published when the telemetry status is "CRITICAL".
     */
    @Test
    void shouldCreateAlertWhenStatusIsCritical() {
        ProcessedTelemetryEvent event = ProcessedTelemetryEvent.builder()
                .deviceId("sensor-1")
                .status("CRITICAL")
                .enrichedData(Map.of("temp", 45.0))
                .build();

        Alert savedAlert = Alert.builder()
                .id(UUID.randomUUID())
                .deviceId("sensor-1")
                .severity("HIGH")
                .build();

        when(alertRepository.save(any(Alert.class))).thenReturn(savedAlert);

        listener.handleProcessedTelemetry(event);

        verify(alertRepository, times(1)).save(any(Alert.class));
        verify(kafkaTemplate, times(1)).send(eq("alert-created"), eq("sensor-1"), any(AlertCreatedEvent.class));
    }

    /**
     * Verifies that a MEDIUM alert is created and published when the telemetry status is "WARNING".
     */
    @Test
    void shouldCreateMediumAlertWhenStatusIsWarning() {
        ProcessedTelemetryEvent event = ProcessedTelemetryEvent.builder()
                .deviceId("sensor-1")
                .status("WARNING")
                .enrichedData(Map.of("temperature", 85.0))
                .build();

        Alert savedAlert = Alert.builder()
                .id(UUID.randomUUID())
                .deviceId("sensor-1")
                .severity("MEDIUM")
                .build();

        when(alertRepository.save(any(Alert.class))).thenReturn(savedAlert);

        listener.handleProcessedTelemetry(event);

        ArgumentCaptor<Alert> alertCaptor = ArgumentCaptor.forClass(Alert.class);
        verify(alertRepository, times(1)).save(alertCaptor.capture());
        assertThat(alertCaptor.getValue().getSeverity()).isEqualTo("MEDIUM");
        verify(kafkaTemplate, times(1)).send(eq("alert-created"), eq("sensor-1"), any(AlertCreatedEvent.class));
    }

    /**
     * Verifies that no alert is created when the telemetry status is "NORMAL".
     */
    @Test
    void shouldNotCreateAlertWhenStatusIsNormal() {
        ProcessedTelemetryEvent event = ProcessedTelemetryEvent.builder()
                .deviceId("sensor-1")
                .status("NORMAL")
                .build();

        listener.handleProcessedTelemetry(event);

        verify(alertRepository, never()).save(any());
        verify(kafkaTemplate, never()).send(anyString(), anyString(), any());
    }

    /**
     * Verifies that a redelivered event (same eventId) does not create a second alert.
     */
    @Test
    void shouldSkipDuplicateEvent() {
        UUID eventId = UUID.randomUUID();
        ProcessedTelemetryEvent event = ProcessedTelemetryEvent.builder()
                .eventId(eventId)
                .deviceId("sensor-1")
                .status("CRITICAL")
                .enrichedData(Map.of("temp", 45.0))
                .build();
        when(idempotencyRecordRepository.existsById(eventId)).thenReturn(true);

        listener.handleProcessedTelemetry(event);

        verify(alertRepository, never()).save(any(Alert.class));
        verify(kafkaTemplate, never()).send(anyString(), anyString(), any(AlertCreatedEvent.class));
    }

    /**
     * Verifies that the idempotency record is stored together with a newly created alert.
     */
    @Test
    void shouldRecordEventIdWhenAlertCreated() {
        UUID eventId = UUID.randomUUID();
        ProcessedTelemetryEvent event = ProcessedTelemetryEvent.builder()
                .eventId(eventId)
                .deviceId("sensor-1")
                .status("WARNING")
                .enrichedData(Map.of("temperature", 85.0))
                .build();
        when(alertRepository.save(any(Alert.class))).thenReturn(
                Alert.builder().id(UUID.randomUUID()).deviceId("sensor-1").severity("MEDIUM").build());

        listener.handleProcessedTelemetry(event);

        verify(idempotencyRecordRepository).save(argThat(r -> eventId.equals(r.getEventId())));
    }
}
