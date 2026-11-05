package com.franciscobalonero.iotplatform.processing.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.retrytopic.RetryTopicConfiguration;
import org.springframework.kafka.retrytopic.RetryTopicConfigurationBuilder;
import org.springframework.retry.annotation.EnableRetry;

/**
 * Configuration for Kafka Retry and Dead Letter Queue (DLQ).
 * Implements a retry mechanism for failed telemetry processing.
 *
 * @author Francisco Balonero Olivera
 */
@Configuration
@EnableRetry
public class KafkaRetryConfig {

    /**
     * Configures a retry topic with a fixed backoff strategy and a maximum of 3 attempts.
     * Failed attempts after retries are routed to the DLQ topic.
     *
     * @param kafkaTemplate The KafkaTemplate for publishing events.
     * @return The retry topic configuration.
     */
    @Bean
    public RetryTopicConfiguration retryTopic(KafkaTemplate<String, Object> kafkaTemplate) {
        return RetryTopicConfigurationBuilder
                .newInstance()
                .fixedBackOff(2000) // 2 seconds between retries
                .maxAttempts(3)
                .includeTopic("device-data-received")
                .create(kafkaTemplate);
    }
}
