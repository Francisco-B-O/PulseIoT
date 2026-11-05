package com.franciscobalonero.iotplatform.analytics;

/**
 * Centralises the Redis key prefixes and configuration constants used by
 * {@link com.franciscobalonero.iotplatform.analytics.listener.AnalyticsListener}
 * and {@link com.franciscobalonero.iotplatform.analytics.service.AnalyticsService}.
 *
 * <p>All keys follow the pattern {@code analytics:<type>:<deviceId>}.</p>
 *
 * @author Francisco Balonero Olivera
 */
public final class AnalyticsRedisKeys {

    /** Prefix for the cumulative telemetry event counter per device. */
    public static final String EVENT_COUNT = "analytics:event-count:";

    /** Prefix for the last-seen timestamp (epoch ms) per device. */
    public static final String LAST_SEEN   = "analytics:last-seen:";

    /** Prefix for the telemetry history list per device. */
    public static final String HISTORY     = "analytics:history:";

    /** Maximum number of history entries retained per device. */
    public static final int HISTORY_MAX    = 50;

    private AnalyticsRedisKeys() {}
}
