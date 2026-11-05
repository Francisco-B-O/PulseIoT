package com.franciscobalonero.iotplatform.analytics.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.franciscobalonero.iotplatform.analytics.AnalyticsRedisKeys;
import com.franciscobalonero.iotplatform.common.event.DeviceTelemetryEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link AnalyticsListener}.
 */
@ExtendWith(MockitoExtension.class)
class AnalyticsListenerTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOps;

    @Mock
    private ListOperations<String, String> listOps;

    private AnalyticsListener analyticsListener;

    @BeforeEach
    void setUp() {
        analyticsListener = new AnalyticsListener(redisTemplate, new ObjectMapper());
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(redisTemplate.opsForList()).thenReturn(listOps);
    }

    private static final String DEVICE_ID = "sensor-01";

    @Test
    void shouldIncrementEventCountSetLastSeenAndPushHistory() {
        DeviceTelemetryEvent event = DeviceTelemetryEvent.builder()
                .eventId(UUID.randomUUID())
                .deviceId(DEVICE_ID)
                .payload(Map.of("temperature", 22.5, "humidity", 65.0, "vibration", 0.05))
                .build();

        analyticsListener.handleTelemetry(event);

        verify(valueOps).increment(AnalyticsRedisKeys.EVENT_COUNT + DEVICE_ID);
        verify(valueOps).set(eq(AnalyticsRedisKeys.LAST_SEEN + DEVICE_ID), anyString());
        verify(listOps).leftPush(eq(AnalyticsRedisKeys.HISTORY + DEVICE_ID), anyString());
        verify(listOps).trim(eq(AnalyticsRedisKeys.HISTORY + DEVICE_ID), eq(0L),
                eq((long) (AnalyticsRedisKeys.HISTORY_MAX - 1)));
    }

    @Test
    void shouldHandleEventWithNullPayload() {
        DeviceTelemetryEvent event = DeviceTelemetryEvent.builder()
                .eventId(UUID.randomUUID())
                .deviceId(DEVICE_ID)
                .payload(null)
                .build();

        analyticsListener.handleTelemetry(event);

        // increment and last-seen should still be called even with null payload
        verify(valueOps).increment(AnalyticsRedisKeys.EVENT_COUNT + DEVICE_ID);
        verify(valueOps).set(eq(AnalyticsRedisKeys.LAST_SEEN + DEVICE_ID), anyString());
        // history snapshot with defaults (0) is still pushed
        verify(listOps).leftPush(eq(AnalyticsRedisKeys.HISTORY + DEVICE_ID), anyString());
    }

    @Test
    void shouldHandleEventWithEmptyPayload() {
        DeviceTelemetryEvent event = DeviceTelemetryEvent.builder()
                .eventId(UUID.randomUUID())
                .deviceId("sensor-empty")
                .payload(Map.of())
                .build();

        analyticsListener.handleTelemetry(event);

        verify(valueOps).increment(AnalyticsRedisKeys.EVENT_COUNT + "sensor-empty");
        verify(listOps).leftPush(eq(AnalyticsRedisKeys.HISTORY + "sensor-empty"), anyString());
    }
}
