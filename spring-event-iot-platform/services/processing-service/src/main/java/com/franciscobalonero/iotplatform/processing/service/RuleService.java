package com.franciscobalonero.iotplatform.processing.service;

import com.franciscobalonero.iotplatform.processing.model.Rule;
import com.franciscobalonero.iotplatform.processing.repository.RuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service class for managing processing rules and thresholds.
 * Centralizes the rule state and business logic for the processing service.
 * Rules are automatically initialized via RuleInitializer after application startup.
 *
 * @author Francisco Balonero Olivera
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class RuleService {

    private final RuleRepository ruleRepository;
    private static final double DEFAULT_TEMPERATURE_THRESHOLD = 100.0;
    private static final String TEMPERATURE_METRIC = "temperature";

    /**
     * Updates the current temperature threshold.
     * Creates the rule entry if it does not exist yet.
     *
     * @param threshold The new threshold value.
     */
    @Transactional
    public void updateTemperatureThreshold(double threshold) {
        try {
            log.info("Updating temperature threshold to: {}", threshold);
            Rule rule = ruleRepository.findByMetric(TEMPERATURE_METRIC)
                    .orElseGet(() -> Rule.builder()
                            .metric(TEMPERATURE_METRIC)
                            .ruleName("Default Temperature Check")
                            .build());
            rule.setThreshold(threshold);
            ruleRepository.save(rule);
        } catch (Exception e) {
            log.warn("Error updating temperature threshold: {}", e.getMessage());
        }
    }

    /**
     * Retrieves the current temperature threshold.
     * Falls back to {@value DEFAULT_TEMPERATURE_THRESHOLD} if no rule is found or an error occurs.
     * Default rules are guaranteed to exist after {@link com.franciscobalonero.iotplatform.processing.config.RuleInitializer} runs.
     *
     * @return The temperature threshold value.
     */
    @Transactional(readOnly = true)
    public double getTemperatureThreshold() {
        try {
            return ruleRepository.findByMetric(TEMPERATURE_METRIC)
                    .map(Rule::getThreshold)
                    .orElse(DEFAULT_TEMPERATURE_THRESHOLD);
        } catch (Exception e) {
            log.warn("Error retrieving temperature threshold: {}. Using default threshold.", e.getMessage());
            return DEFAULT_TEMPERATURE_THRESHOLD;
        }
    }
}
