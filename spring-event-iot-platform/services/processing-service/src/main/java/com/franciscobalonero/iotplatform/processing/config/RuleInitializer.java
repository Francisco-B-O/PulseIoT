package com.franciscobalonero.iotplatform.processing.config;

import com.franciscobalonero.iotplatform.processing.model.Rule;
import com.franciscobalonero.iotplatform.processing.repository.RuleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Initializes default rules after the application is ready and the database is initialized.
 * This avoids race conditions with Hibernate schema creation.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RuleInitializer {

    private final RuleRepository ruleRepository;

    /**
     * Initialize default rules after application startup.
     */
    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void initializeDefaultRules() {
        try {
            log.info("Initializing default rules after application startup...");
            
            // Check and initialize temperature rule
            if (ruleRepository.findByMetric("temperature").isEmpty()) {
                log.info("Creating default temperature rule.");
                ruleRepository.save(Rule.builder()
                        .ruleName("Default Temperature Check")
                        .metric("temperature")
                        .threshold(100.0)
                        .description("Default threshold for temperature alerts")
                        .build());
                log.info("✓ Default temperature rule created successfully.");
            } else {
                log.info("✓ Temperature rule already exists.");
            }
            
        } catch (Exception e) {
            log.error("Error initializing default rules: {}", e.getMessage(), e);
        }
    }
}
