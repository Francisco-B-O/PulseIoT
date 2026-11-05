package com.franciscobalonero.iotplatform.alert.service;

import com.franciscobalonero.iotplatform.alert.repository.AlertRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for the bulk acknowledge operation of {@link AlertService}.
 */
@ExtendWith(MockitoExtension.class)
class AlertServiceTest {

    @Mock
    private AlertRepository alertRepository;

    @InjectMocks
    private AlertService alertService;

    @Test
    void shouldAcknowledgeAllPendingAlertsInOneStatement() {
        when(alertRepository.acknowledgeAllPending()).thenReturn(42);

        int count = alertService.acknowledgeAll();

        assertThat(count).isEqualTo(42);
        verify(alertRepository).acknowledgeAllPending();
    }
}
