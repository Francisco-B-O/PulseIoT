package com.franciscobalonero.iotplatform.alert.service;

import com.franciscobalonero.iotplatform.alert.dto.AlertDto;
import com.franciscobalonero.iotplatform.alert.mapper.AlertMapper;
import com.franciscobalonero.iotplatform.alert.model.Alert;
import com.franciscobalonero.iotplatform.alert.repository.AlertRepository;
import com.franciscobalonero.iotplatform.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Service class for managing alert business logic.
 *
 * @author Francisco Balonero Olivera
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AlertService {

    private final AlertRepository alertRepository;
    private final AlertMapper alertMapper;

    /**
     * Retrieves all alerts.
     *
     * @return A list of alert DTOs.
     */
    @Transactional(readOnly = true)
    public List<AlertDto> getAllAlerts() {
        return alertMapper.toDtoList(alertRepository.findAll());
    }

    /**
     * Acknowledges an alert by its ID.
     *
     * @param id The unique identifier of the alert.
     * @return The updated alert DTO.
     * @throws ResourceNotFoundException if the alert is not found.
     */
    @Transactional
    public AlertDto acknowledgeAlert(UUID id) {
        log.info("Acknowledging alert with ID: {}", id);
        Alert alert = alertRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Alert with ID " + id + " not found"));
        
        alert.setAcknowledged(true);
        Alert updatedAlert = alertRepository.save(alert);
        return alertMapper.toDto(updatedAlert);
    }

    /**
     * Acknowledges every pending alert in one transaction (avoids N requests from the UI).
     *
     * @return The number of alerts that were acknowledged.
     */
    @Transactional
    public int acknowledgeAll() {
        int count = alertRepository.acknowledgeAllPending();
        log.info("Acknowledged {} pending alerts", count);
        return count;
    }
}
