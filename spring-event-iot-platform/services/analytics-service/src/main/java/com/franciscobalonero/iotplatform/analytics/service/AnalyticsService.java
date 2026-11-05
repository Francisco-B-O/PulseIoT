package com.franciscobalonero.iotplatform.analytics.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.franciscobalonero.iotplatform.analytics.AnalyticsRedisKeys;
import com.franciscobalonero.iotplatform.analytics.dto.AnalyticsDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Service class for retrieving device analytics from Redis.
 *
 * @author Francisco Balonero Olivera
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AnalyticsService {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    private static final TypeReference<Map<String, Object>> MAP_TYPE_REF =
            new TypeReference<>() {};

    /**
     * Retrieves stats for a device: event count and last-seen timestamp.
     */
    public AnalyticsDto getDeviceStats(String deviceId) {
        log.debug("Fetching stats for device: {}", deviceId);

        String countStr    = redisTemplate.opsForValue().get(AnalyticsRedisKeys.EVENT_COUNT + deviceId);
        String lastSeenStr = redisTemplate.opsForValue().get(AnalyticsRedisKeys.LAST_SEEN   + deviceId);

        long eventCount = countStr    != null ? Long.parseLong(countStr)    : 0L;
        Long lastSeen   = lastSeenStr != null ? Long.parseLong(lastSeenStr) : null;

        return AnalyticsDto.builder()
                .deviceId(deviceId)
                .eventCount(eventCount)
                .lastSeen(lastSeen)
                .build();
    }

    /**
     * Returns the last 50 telemetry snapshots for the given device (newest first).
     * Each entry contains: ts (epoch ms), temperature, humidity, vibration.
     */
    public List<Map<String, Object>> getDeviceHistory(String deviceId) {
        log.debug("Fetching history for device: {}", deviceId);

        List<String> raw = redisTemplate.opsForList().range(AnalyticsRedisKeys.HISTORY + deviceId, 0, AnalyticsRedisKeys.HISTORY_MAX - 1);
        if (raw == null || raw.isEmpty()) return Collections.emptyList();

        return raw.stream()
                .map(entry -> {
                    try {
                        return objectMapper.readValue(entry, MAP_TYPE_REF);
                    } catch (Exception e) {
                        log.warn("Unparseable history entry: {}", entry);
                        return null;
                    }
                })
                .filter(Objects::nonNull)
                .toList();
    }
}
