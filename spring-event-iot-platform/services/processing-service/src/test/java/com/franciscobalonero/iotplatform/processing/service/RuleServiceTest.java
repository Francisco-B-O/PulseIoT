package com.franciscobalonero.iotplatform.processing.service;

import com.franciscobalonero.iotplatform.processing.model.Rule;
import com.franciscobalonero.iotplatform.processing.repository.RuleRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link RuleService}.
 */
@ExtendWith(MockitoExtension.class)
class RuleServiceTest {

    @Mock
    private RuleRepository ruleRepository;

    @InjectMocks
    private RuleService ruleService;

    private static final String TEMPERATURE = "temperature";

    // ── updateTemperatureThreshold() ─────────────────────────────────────────────

    @Test
    void shouldCreateRuleWhenNoneExists() {
        when(ruleRepository.findByMetric(TEMPERATURE)).thenReturn(Optional.empty());
        when(ruleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ruleService.updateTemperatureThreshold(90.0);

        ArgumentCaptor<Rule> captor = ArgumentCaptor.forClass(Rule.class);
        verify(ruleRepository).save(captor.capture());
        assertThat(captor.getValue().getThreshold()).isEqualTo(90.0);
    }

    @Test
    void shouldUpdateExistingRule() {
        Rule existing = Rule.builder().metric(TEMPERATURE).threshold(100.0).ruleName("Default Temperature Check").build();
        when(ruleRepository.findByMetric(TEMPERATURE)).thenReturn(Optional.of(existing));
        when(ruleRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ruleService.updateTemperatureThreshold(120.0);

        assertThat(existing.getThreshold()).isEqualTo(120.0);
        verify(ruleRepository).save(existing);
    }

    // ── getTemperatureThreshold() ─────────────────────────────────────────────────

    @Test
    void shouldReturnThresholdFromRepository() {
        Rule rule = Rule.builder().metric(TEMPERATURE).threshold(85.0).build();
        when(ruleRepository.findByMetric(TEMPERATURE)).thenReturn(Optional.of(rule));

        double result = ruleService.getTemperatureThreshold();

        assertThat(result).isEqualTo(85.0);
    }

    @Test
    void shouldReturnDefaultWhenNoRuleExists() {
        when(ruleRepository.findByMetric(TEMPERATURE)).thenReturn(Optional.empty());

        double result = ruleService.getTemperatureThreshold();

        assertThat(result).isEqualTo(100.0);
    }

    @Test
    void shouldReturnDefaultWhenRepositoryThrows() {
        when(ruleRepository.findByMetric(TEMPERATURE)).thenThrow(new RuntimeException("DB error"));

        double result = ruleService.getTemperatureThreshold();

        assertThat(result).isEqualTo(100.0);
    }
}
