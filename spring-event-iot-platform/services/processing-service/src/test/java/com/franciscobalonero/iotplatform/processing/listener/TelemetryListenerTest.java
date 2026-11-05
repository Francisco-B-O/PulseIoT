package com.franciscobalonero.iotplatform.processing.listener;

import com.franciscobalonero.iotplatform.common.event.DeviceTelemetryEvent;
import com.franciscobalonero.iotplatform.common.event.ProcessedTelemetryEvent;
import com.franciscobalonero.iotplatform.processing.client.DeviceClient;
import com.franciscobalonero.iotplatform.processing.model.IdempotencyRecord;
import com.franciscobalonero.iotplatform.processing.repository.IdempotencyRecordRepository;
import com.franciscobalonero.iotplatform.processing.service.RuleService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.kafka.core.KafkaTemplate;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link TelemetryListener}.
 */
@ExtendWith(MockitoExtension.class)
class TelemetryListenerTest {

    @Mock
    private DeviceClient deviceClient;

    @Mock
    private RuleService ruleService;

    @Mock
    private IdempotencyRecordRepository idempotencyRecordRepository;

    @Mock
    private KafkaTemplate<String, ProcessedTelemetryEvent> kafkaTemplate;

    @InjectMocks
    private TelemetryListener telemetryListener;

    private DeviceClient.DeviceResponse deviceResponse(String id) {
        DeviceClient.DeviceResponse r = new DeviceClient.DeviceResponse();
        r.setDeviceId(id);
        r.setType("TEMP_SENSOR");
        return r;
    }

    /**
     * Temperature 115°C exceeds 100°C threshold → CRITICAL.
     */
    @Test
    void shouldProcessCriticalTelemetry() {
        DeviceTelemetryEvent event = DeviceTelemetryEvent.builder()
                .eventId(UUID.randomUUID()).deviceId("sensor-1")
                .payload(Map.of("temperature", 115.0)).build();

        when(idempotencyRecordRepository.existsById(any())).thenReturn(false);
        when(idempotencyRecordRepository.saveAndFlush(any(IdempotencyRecord.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(deviceClient.getDeviceById("sensor-1")).thenReturn(Optional.of(deviceResponse("sensor-1")));
        when(ruleService.getTemperatureThreshold()).thenReturn(100.0);

        telemetryListener.handleTelemetry(event);

        ArgumentCaptor<ProcessedTelemetryEvent> captor = ArgumentCaptor.forClass(ProcessedTelemetryEvent.class);
        verify(kafkaTemplate).send(eq("device-data-processed"), eq("sensor-1"), captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo("CRITICAL");
        assertThat(captor.getValue().getEnrichedData()).containsEntry("deviceType", "TEMP_SENSOR");
    }

    /**
     * Temperature 85°C, threshold 100°C → 85 > 80 (100*0.8) → WARNING.
     */
    @Test
    void shouldProcessWarningTelemetry() {
        DeviceTelemetryEvent event = DeviceTelemetryEvent.builder()
                .eventId(UUID.randomUUID()).deviceId("sensor-1")
                .payload(Map.of("temperature", 85.0)).build();

        when(idempotencyRecordRepository.existsById(any())).thenReturn(false);
        when(idempotencyRecordRepository.saveAndFlush(any(IdempotencyRecord.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(deviceClient.getDeviceById("sensor-1")).thenReturn(Optional.of(deviceResponse("sensor-1")));
        when(ruleService.getTemperatureThreshold()).thenReturn(100.0);

        telemetryListener.handleTelemetry(event);

        ArgumentCaptor<ProcessedTelemetryEvent> captor = ArgumentCaptor.forClass(ProcessedTelemetryEvent.class);
        verify(kafkaTemplate).send(eq("device-data-processed"), eq("sensor-1"), captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo("WARNING");
    }

    /**
     * Temperature 50°C, threshold 100°C → 50 <= 80 → NORMAL.
     */
    @Test
    void shouldProcessNormalTelemetry() {
        DeviceTelemetryEvent event = DeviceTelemetryEvent.builder()
                .eventId(UUID.randomUUID()).deviceId("sensor-1")
                .payload(Map.of("temperature", 50.0)).build();

        when(idempotencyRecordRepository.existsById(any())).thenReturn(false);
        when(idempotencyRecordRepository.saveAndFlush(any(IdempotencyRecord.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(deviceClient.getDeviceById("sensor-1")).thenReturn(Optional.of(deviceResponse("sensor-1")));
        when(ruleService.getTemperatureThreshold()).thenReturn(100.0);

        telemetryListener.handleTelemetry(event);

        ArgumentCaptor<ProcessedTelemetryEvent> captor = ArgumentCaptor.forClass(ProcessedTelemetryEvent.class);
        verify(kafkaTemplate).send(eq("device-data-processed"), eq("sensor-1"), captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo("NORMAL");
    }

    /**
     * Duplicate event is skipped (idempotency check).
     */
    @Test
    void shouldSkipDuplicateEvent() {
        UUID eventId = UUID.randomUUID();
        DeviceTelemetryEvent event = DeviceTelemetryEvent.builder()
                .eventId(eventId).deviceId("sensor-1")
                .payload(Map.of("temperature", 25.0)).build();

        when(idempotencyRecordRepository.existsById(eventId)).thenReturn(true);

        telemetryListener.handleTelemetry(event);

        verify(kafkaTemplate, never()).send(any(), any(), any(ProcessedTelemetryEvent.class));
    }

    /**
     * A concurrent redelivery claimed the event first (unique violation) → nothing is published.
     */
    @Test
    void shouldNotPublishWhenEventClaimedConcurrently() {
        DeviceTelemetryEvent event = DeviceTelemetryEvent.builder()
                .eventId(UUID.randomUUID()).deviceId("sensor-1")
                .payload(Map.of("temperature", 25.0)).build();

        when(idempotencyRecordRepository.existsById(any())).thenReturn(false);
        when(idempotencyRecordRepository.saveAndFlush(any(IdempotencyRecord.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate key"));
        when(deviceClient.getDeviceById("sensor-1")).thenReturn(Optional.of(deviceResponse("sensor-1")));
        when(ruleService.getTemperatureThreshold()).thenReturn(100.0);

        telemetryListener.handleTelemetry(event);

        verify(kafkaTemplate, never()).send(any(), any(), any(ProcessedTelemetryEvent.class));
    }

    /**
     * Device not found in registry → skip processing.
     */
    @Test
    void shouldSkipWhenDeviceNotInRegistry() {
        DeviceTelemetryEvent event = DeviceTelemetryEvent.builder()
                .eventId(UUID.randomUUID()).deviceId("ghost-device")
                .payload(Map.of("temperature", 25.0)).build();

        when(idempotencyRecordRepository.existsById(any())).thenReturn(false);
        when(deviceClient.getDeviceById("ghost-device")).thenReturn(Optional.empty());

        telemetryListener.handleTelemetry(event);

        verify(kafkaTemplate, never()).send(any(), any(), any(ProcessedTelemetryEvent.class));
    }

    /**
     * Non-numeric temperature value → NORMAL status (no exception).
     */
    @Test
    void shouldHandleNonNumericTemperatureAsNormal() {
        DeviceTelemetryEvent event = DeviceTelemetryEvent.builder()
                .eventId(UUID.randomUUID()).deviceId("sensor-1")
                .payload(Map.of("temperature", "not-a-number")).build();

        when(idempotencyRecordRepository.existsById(any())).thenReturn(false);
        when(idempotencyRecordRepository.saveAndFlush(any(IdempotencyRecord.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(deviceClient.getDeviceById("sensor-1")).thenReturn(Optional.of(deviceResponse("sensor-1")));

        telemetryListener.handleTelemetry(event);

        ArgumentCaptor<ProcessedTelemetryEvent> captor = ArgumentCaptor.forClass(ProcessedTelemetryEvent.class);
        verify(kafkaTemplate).send(eq("device-data-processed"), eq("sensor-1"), captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo("NORMAL");
    }

    /**
     * Missing temperature key in payload → tempVal is null → not instanceof Number,
     * null-check branch → NORMAL (no warn log).
     */
    @Test
    void shouldTreatNullTemperatureAsNormal() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("temperature", null);
        DeviceTelemetryEvent event = DeviceTelemetryEvent.builder()
                .eventId(UUID.randomUUID()).deviceId("sensor-1")
                .payload(payload).build();

        when(idempotencyRecordRepository.existsById(any())).thenReturn(false);
        when(idempotencyRecordRepository.saveAndFlush(any(IdempotencyRecord.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(deviceClient.getDeviceById("sensor-1")).thenReturn(Optional.of(deviceResponse("sensor-1")));

        telemetryListener.handleTelemetry(event);

        ArgumentCaptor<ProcessedTelemetryEvent> captor = ArgumentCaptor.forClass(ProcessedTelemetryEvent.class);
        verify(kafkaTemplate).send(eq("device-data-processed"), eq("sensor-1"), captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo("NORMAL");
    }

    /**
     * Idempotency record is stored after successful processing.
     */
    @Test
    void shouldStoreIdempotencyRecordOnSuccess() {
        UUID eventId = UUID.randomUUID();
        DeviceTelemetryEvent event = DeviceTelemetryEvent.builder()
                .eventId(eventId).deviceId("sensor-1")
                .payload(Map.of("temperature", 25.0)).build();

        when(idempotencyRecordRepository.existsById(any())).thenReturn(false);
        when(idempotencyRecordRepository.saveAndFlush(any(IdempotencyRecord.class)))
                .thenAnswer(inv -> inv.getArgument(0));
        when(deviceClient.getDeviceById("sensor-1")).thenReturn(Optional.of(deviceResponse("sensor-1")));
        when(ruleService.getTemperatureThreshold()).thenReturn(100.0);

        telemetryListener.handleTelemetry(event);

        ArgumentCaptor<IdempotencyRecord> captor = ArgumentCaptor.forClass(IdempotencyRecord.class);
        verify(idempotencyRecordRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getEventId()).isEqualTo(eventId);
    }
}
