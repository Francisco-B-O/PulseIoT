package com.franciscobalonero.iotplatform.device.service;

import com.franciscobalonero.iotplatform.device.dto.CreateDeviceRequest;
import com.franciscobalonero.iotplatform.device.dto.DeviceDto;
import com.franciscobalonero.iotplatform.device.dto.DeviceMapDto;
import com.franciscobalonero.iotplatform.device.mapper.DeviceMapper;
import com.franciscobalonero.iotplatform.device.model.Area;
import com.franciscobalonero.iotplatform.device.model.Device;
import com.franciscobalonero.iotplatform.device.repository.AreaRepository;
import com.franciscobalonero.iotplatform.device.repository.DeviceRepository;
import com.franciscobalonero.iotplatform.common.exception.ConflictException;
import com.franciscobalonero.iotplatform.common.exception.BadRequestException;
import com.franciscobalonero.iotplatform.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service class for managing device business logic.
 * Handles device registration, retrieval, and deletion operations.
 *
 * @author Francisco Balonero Olivera
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceService {

    private static final String DEVICE_WITH_ID_PREFIX = "Device with ID ";
    private static final String NOT_FOUND_SUFFIX      = " not found";

    private final DeviceRepository deviceRepository;
    private final AreaRepository areaRepository;
    private final DeviceMapper deviceMapper;

    /**
     * Retrieves all registered devices.
     *
     * @return A list of all devices as DTOs.
     */
    @Transactional(readOnly = true)
    public List<DeviceDto> getAllDevices() {
        return deviceMapper.toDtoList(deviceRepository.findAll());
    }

    /**
     * Retrieves a device by its unique device identifier.
     *
     * @param deviceId The unique identifier of the device.
     * @return An optional containing the device DTO if found.
     */
    @Transactional(readOnly = true)
    public Optional<DeviceDto> getDeviceById(String deviceId) {
        return deviceRepository.findByDeviceId(deviceId)
                .map(deviceMapper::toDto);
    }

    /**
     * Creates a new device registration.
     *
     * @param request The request containing device registration details.
     * @return The saved device DTO.
     * @throws ConflictException if a device with the same ID already exists.
     */
    @Transactional
    public DeviceDto createDevice(CreateDeviceRequest request) {
        log.info("Creating device with ID: {}", request.getDeviceId());
        
        if (deviceRepository.findByDeviceId(request.getDeviceId()).isPresent()) {
            throw new ConflictException(DEVICE_WITH_ID_PREFIX + request.getDeviceId() + " already exists");
        }

        Device device = deviceMapper.toEntity(request);
        Device savedDevice = deviceRepository.save(device);
        return deviceMapper.toDto(savedDevice);
    }

    /**
     * Deletes a device registration by its device identifier.
     *
     * @param deviceId The unique identifier of the device to delete.
     * @throws ResourceNotFoundException if the device is not found.
     */
    @Transactional
    public void deleteDevice(String deviceId) {
        log.info("Deleting device with ID: {}", deviceId);
        Device device = deviceRepository.findByDeviceId(deviceId)
                .orElseThrow(() -> new ResourceNotFoundException(DEVICE_WITH_ID_PREFIX + deviceId + NOT_FOUND_SUFFIX));
        deviceRepository.delete(device);
    }

    /**
     * Returns a map-optimised list of all devices, including their GPS coordinates
     * and the name of the area each device is assigned to (if any).
     *
     * @return List of {@link DeviceMapDto} — one entry per device.
     */
    @Transactional(readOnly = true)
    public List<DeviceMapDto> getDevicesForMap() {
        List<Device> devices = deviceRepository.findAll();

        // Build device-UUID → area-name lookup in two queries (not N+1)
        List<Area> areas = areaRepository.findAllWithDevices();
        Map<UUID, String> deviceIdToAreaName = areas.stream()
                .flatMap(area -> area.getDevices().stream()
                        .map(device -> Map.entry(device.getId(), area.getName())))
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        Map.Entry::getValue,
                        (first, second) -> first   // keep first area when device belongs to multiple
                ));

        return devices.stream()
                .map(d -> DeviceMapDto.builder()
                        .deviceId(d.getDeviceId())
                        .type(d.getType())
                        .status(d.getStatus())
                        .latitude(d.getLatitude())
                        .longitude(d.getLongitude())
                        .simulated(d.isSimulated())
                        .areaName(deviceIdToAreaName.get(d.getId()))
                        .build())
                .toList();
    }

    /**
     * Enables or disables simulation for a device.
     *
     * @param deviceId The unique identifier of the device.
     * @param simulated Whether the device should be simulated.
     * @return The updated device DTO.
     * @throws ResourceNotFoundException if the device is not found.
     */
    @Transactional
    public DeviceDto setSimulated(String deviceId, boolean simulated) {
        log.info("Setting simulated={} for device: {}", simulated, deviceId);
        Device device = deviceRepository.findByDeviceId(deviceId)
                .orElseThrow(() -> new ResourceNotFoundException(DEVICE_WITH_ID_PREFIX + deviceId + NOT_FOUND_SUFFIX));
        device.setSimulated(simulated);
        return deviceMapper.toDto(deviceRepository.save(device));
    }

    /**
     * Updates the GPS coordinates of a device.
     * Pass {@code null} for both {@code latitude} and {@code longitude} to clear the location.
     *
     * @param deviceId  The unique identifier of the device.
     * @param latitude  New latitude value, or {@code null} to clear.
     * @param longitude New longitude value, or {@code null} to clear.
     * @return The updated device DTO.
     * @throws ResourceNotFoundException if the device is not found.
     */
    @Transactional
    public DeviceDto updateLocation(String deviceId, Double latitude, Double longitude) {
        if ((latitude == null) != (longitude == null)) {
            throw new BadRequestException("latitude and longitude must be provided together (or both omitted to clear)");
        }
        if (latitude != null && (latitude < -90 || latitude > 90 || latitude.isNaN())) {
            throw new BadRequestException("latitude must be between -90 and 90");
        }
        if (longitude != null && (longitude < -180 || longitude > 180 || longitude.isNaN())) {
            throw new BadRequestException("longitude must be between -180 and 180");
        }
        log.info("Updating location for device '{}': lat={}, lng={}", deviceId, latitude, longitude);
        Device device = deviceRepository.findByDeviceId(deviceId)
                .orElseThrow(() -> new ResourceNotFoundException(DEVICE_WITH_ID_PREFIX + deviceId + NOT_FOUND_SUFFIX));
        device.setLatitude(latitude);
        device.setLongitude(longitude);
        return deviceMapper.toDto(deviceRepository.save(device));
    }
}
