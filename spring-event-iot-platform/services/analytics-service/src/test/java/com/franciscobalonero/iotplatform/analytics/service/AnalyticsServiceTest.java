package com.franciscobalonero.iotplatform.analytics.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.franciscobalonero.iotplatform.analytics.AnalyticsRedisKeys;
import com.franciscobalonero.iotplatform.analytics.dto.AnalyticsDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.ListOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link AnalyticsService}.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AnalyticsServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOps;

    @Mock
    private ListOperations<String, String> listOps;

    @InjectMocks
    private AnalyticsService analyticsService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // We need to inject a real ObjectMapper; let's recreate the service with it
    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        analyticsService = new AnalyticsService(redisTemplate, objectMapper);
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
    }

    private static final String DEVICE_ID = "sensor-42";

    @Test
    void shouldReturnStatsWithEventCountAndLastSeen() {
        when(valueOps.get(AnalyticsRedisKeys.EVENT_COUNT + DEVICE_ID)).thenReturn("17");
        when(valueOps.get(AnalyticsRedisKeys.LAST_SEEN + DEVICE_ID)).thenReturn("1700000000000");

        AnalyticsDto result = analyticsService.getDeviceStats(DEVICE_ID);

        assertThat(result.getDeviceId()).isEqualTo(DEVICE_ID);
        assertThat(result.getEventCount()).isEqualTo(17L);
        assertThat(result.getLastSeen()).isEqualTo(1700000000000L);
    }

    @Test
    void shouldDefaultEventCountToZeroWhenNull() {
        when(valueOps.get(AnalyticsRedisKeys.EVENT_COUNT + DEVICE_ID)).thenReturn(null);
        when(valueOps.get(AnalyticsRedisKeys.LAST_SEEN + DEVICE_ID)).thenReturn(null);

        AnalyticsDto result = analyticsService.getDeviceStats(DEVICE_ID);

        assertThat(result.getEventCount()).isZero();
        assertThat(result.getLastSeen()).isNull();
    }

    @Test
    void shouldReturnHistoryWithParsedEntries() {
        when(redisTemplate.opsForList()).thenReturn(listOps);

        String entry1 = "{\"ts\":1700000000000,\"temperature\":25.0,\"humidity\":60,\"vibration\":0.1}";
        String entry2 = "{\"ts\":1700000001000,\"temperature\":30.0,\"humidity\":55,\"vibration\":0.2}";
        when(listOps.range(AnalyticsRedisKeys.HISTORY + DEVICE_ID, 0, AnalyticsRedisKeys.HISTORY_MAX - 1))
                .thenReturn(List.of(entry1, entry2));

        List<Map<String, Object>> result = analyticsService.getDeviceHistory(DEVICE_ID);

        assertThat(result).hasSize(2);
        assertThat(result.get(0)).containsKey("ts");
        assertThat(result.get(0)).containsKey("temperature");
    }

    @Test
    void shouldReturnEmptyListWhenHistoryIsNull() {
        when(redisTemplate.opsForList()).thenReturn(listOps);
        when(listOps.range(AnalyticsRedisKeys.HISTORY + DEVICE_ID, 0, AnalyticsRedisKeys.HISTORY_MAX - 1))
                .thenReturn(null);

        List<Map<String, Object>> result = analyticsService.getDeviceHistory(DEVICE_ID);

        assertThat(result).isEmpty();
    }

    @Test
    void shouldFilterOutMalformedJsonEntries() {
        when(redisTemplate.opsForList()).thenReturn(listOps);

        String valid = "{\"ts\":1700000000000,\"temperature\":25.0}";
        String malformed = "NOT_JSON";
        when(listOps.range(AnalyticsRedisKeys.HISTORY + DEVICE_ID, 0, AnalyticsRedisKeys.HISTORY_MAX - 1))
                .thenReturn(List.of(valid, malformed));

        List<Map<String, Object>> result = analyticsService.getDeviceHistory(DEVICE_ID);

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).containsKey("ts");
    }

    @Test
    void shouldReturnEmptyListWhenHistoryIsEmpty() {
        when(redisTemplate.opsForList()).thenReturn(listOps);
        when(listOps.range(AnalyticsRedisKeys.HISTORY + DEVICE_ID, 0, AnalyticsRedisKeys.HISTORY_MAX - 1))
                .thenReturn(List.of());

        List<Map<String, Object>> result = analyticsService.getDeviceHistory(DEVICE_ID);

        assertThat(result).isEmpty();
    }
}
