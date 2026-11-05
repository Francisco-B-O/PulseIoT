package com.franciscobalonero.iotplatform.analytics.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.franciscobalonero.iotplatform.analytics.AnalyticsRedisKeys;
import com.franciscobalonero.iotplatform.common.event.DeviceTelemetryEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Kafka listener component for processing telemetry events for analytics.
 * Updates device statistics, last-seen timestamp, and telemetry history in Redis.
 *
 * @author Francisco Balonero Olivera
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AnalyticsListener {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Handles incoming telemetry events: increments event count, updates last-seen,
     * and stores a telemetry snapshot in the device's history list (capped at 50).
     */
    @KafkaListener(topics = "device-data-received", groupId = "analytics-group")
    public void handleTelemetry(DeviceTelemetryEvent event) {
        String deviceId = event.getDeviceId();
        log.info("Updating analytics for device: {}", deviceId);

        long now = System.currentTimeMillis();

        // 1. Increment event counter
        redisTemplate.opsForValue().increment(AnalyticsRedisKeys.EVENT_COUNT + deviceId);

        // 2. Track last-seen timestamp
        redisTemplate.opsForValue().set(AnalyticsRedisKeys.LAST_SEEN + deviceId, String.valueOf(now));

        // 3. Store telemetry snapshot in history (capped at HISTORY_MAX)
        try {
            Map<String, Object> payload = event.getPayload() != null ? event.getPayload() : Map.of();
            Map<String, Object> snapshot = new LinkedHashMap<>();
            snapshot.put("ts",          now);
            // Only record sensors that were actually reported: a missing reading is not a 0.
            for (String sensor : new String[]{"temperature", "humidity", "vibration"}) {
                if (payload.get(sensor) != null) {
                    snapshot.put(sensor, payload.get(sensor));
                }
            }

            String entry = objectMapper.writeValueAsString(snapshot);
            String histKey = AnalyticsRedisKeys.HISTORY + deviceId;
            redisTemplate.opsForList().leftPush(histKey, entry);
            redisTemplate.opsForList().trim(histKey, 0, AnalyticsRedisKeys.HISTORY_MAX - 1);
        } catch (Exception e) {
            log.warn("Could not store telemetry history for device {}: {}", deviceId, e.getMessage());
        }

        log.debug("Analytics updated for device: {}", deviceId);
    }
}
