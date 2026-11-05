package com.franciscobalonero.iotplatform.device.service;

import com.franciscobalonero.iotplatform.device.dto.AreaRequest;
import com.franciscobalonero.iotplatform.device.dto.AreaResponse;
import com.franciscobalonero.iotplatform.device.mapper.AreaMapper;
import com.franciscobalonero.iotplatform.device.model.Area;
import com.franciscobalonero.iotplatform.device.model.Device;
import com.franciscobalonero.iotplatform.device.repository.AreaRepository;
import com.franciscobalonero.iotplatform.device.repository.DeviceRepository;
import com.franciscobalonero.iotplatform.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Business logic for geographic area management.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AreaService {

    private static final String AREA_PREFIX     = "Area ";
    private static final String NOT_FOUND_SUFFIX = " not found";

    private final AreaRepository areaRepository;
    private final DeviceRepository deviceRepository;
    private final AreaMapper areaMapper;

    /** Returns all areas with their device membership details. */
    @Transactional(readOnly = true)
    public List<AreaResponse> getAllAreas() {
        return areaRepository.findAllWithDevices().stream()
                .map(this::toResponse)
                .toList();
    }

    /** Creates a new geographic area. */
    @Transactional
    public AreaResponse createArea(AreaRequest request) {
        log.info("Creating area '{}'", request.getName());
        Area area = areaMapper.toEntity(request);
        return toResponse(areaRepository.save(area));
    }

    /** Updates the polygon of an existing area. */
    @Transactional
    public AreaResponse updatePolygon(UUID id, AreaRequest request) {
        log.info("Updating polygon for area {}", id);
        Area area = areaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(AREA_PREFIX + id + NOT_FOUND_SUFFIX));
        area.setPolygon(request.getPolygon());
        return toResponse(areaRepository.save(area));
    }

    /** Deletes an area by its ID. */
    @Transactional
    public void deleteArea(UUID id) {
        log.info("Deleting area {}", id);
        Area area = areaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(AREA_PREFIX + id + NOT_FOUND_SUFFIX));
        areaRepository.delete(area);
    }

    /**
     * Assigns a device to an area.
     * The device is looked up by its business {@code deviceId} string.
     * Idempotent: adding the same device twice has no effect.
     */
    @Transactional
    public AreaResponse assignDevice(UUID areaId, String deviceId) {
        log.info("Assigning device '{}' to area {}", deviceId, areaId);

        Area area = areaRepository.findById(areaId)
                .orElseThrow(() -> new ResourceNotFoundException("Area " + areaId + " not found"));

        Device device = deviceRepository.findByDeviceId(deviceId)
                .orElseThrow(() -> new ResourceNotFoundException("Device '" + deviceId + "' not found"));

        boolean alreadyAssigned = area.getDevices().stream()
                .anyMatch(d -> d.getId().equals(device.getId()));
        if (!alreadyAssigned) {
            area.getDevices().add(device);
            areaRepository.save(area);
        }
        return toResponse(area);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private AreaResponse toResponse(Area area) {
        AreaResponse response = areaMapper.toResponse(area);
        List<String> ids = area.getDevices().stream()
                .map(Device::getDeviceId)
                .toList();
        response.setDeviceIds(ids);
        response.setDeviceCount(ids.size());
        return response;
    }
}
