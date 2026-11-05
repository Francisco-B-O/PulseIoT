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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit tests for {@link DeviceService}.
 */
@ExtendWith(MockitoExtension.class)
class DeviceServiceTest {

    @Mock
    private DeviceRepository deviceRepository;

    @Mock
    private AreaRepository areaRepository;

    @Mock
    private DeviceMapper deviceMapper;

    @InjectMocks
    private DeviceService deviceService;

    private static final String SENSOR_1 = "sensor-1";

    private Device buildDevice(String deviceId) {
        return Device.builder().id(UUID.randomUUID()).deviceId(deviceId).type("TEMP").status("ACTIVE").build();
    }

    private DeviceDto buildDto(String deviceId) {
        return DeviceDto.builder().deviceId(deviceId).type("TEMP").status("ACTIVE").build();
    }

    // ── createDevice ─────────────────────────────────────────────────────────────

    @Test
    void shouldCreateDevice() {
        CreateDeviceRequest request = CreateDeviceRequest.builder()
                .deviceId(SENSOR_1).type("TEMP").build();
        Device device = buildDevice(SENSOR_1);
        DeviceDto dto = buildDto(SENSOR_1);

        when(deviceRepository.findByDeviceId(SENSOR_1)).thenReturn(Optional.empty());
        when(deviceMapper.toEntity(any())).thenReturn(device);
        when(deviceRepository.save(any())).thenReturn(device);
        when(deviceMapper.toDto(any())).thenReturn(dto);

        DeviceDto result = deviceService.createDevice(request);
        assertThat(result.getDeviceId()).isEqualTo(SENSOR_1);
    }

    @Test
    void shouldThrowConflictWhenDeviceAlreadyExists() {
        CreateDeviceRequest request = CreateDeviceRequest.builder().deviceId(SENSOR_1).type("TEMP").build();
        when(deviceRepository.findByDeviceId(SENSOR_1)).thenReturn(Optional.of(buildDevice(SENSOR_1)));

        assertThatThrownBy(() -> deviceService.createDevice(request))
                .isInstanceOf(ConflictException.class);
    }

    // ── getAllDevices ─────────────────────────────────────────────────────────────

    @Test
    void shouldReturnAllDevices() {
        Device d = buildDevice(SENSOR_1);
        DeviceDto dto = buildDto(SENSOR_1);
        when(deviceRepository.findAll()).thenReturn(List.of(d));
        when(deviceMapper.toDtoList(any())).thenReturn(List.of(dto));

        List<DeviceDto> result = deviceService.getAllDevices();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getDeviceId()).isEqualTo(SENSOR_1);
    }

    // ── getDeviceById ─────────────────────────────────────────────────────────────

    @Test
    void shouldReturnDeviceWhenFound() {
        Device d = buildDevice(SENSOR_1);
        DeviceDto dto = buildDto(SENSOR_1);
        when(deviceRepository.findByDeviceId(SENSOR_1)).thenReturn(Optional.of(d));
        when(deviceMapper.toDto(d)).thenReturn(dto);

        Optional<DeviceDto> result = deviceService.getDeviceById(SENSOR_1);

        assertThat(result).isPresent();
        assertThat(result.get().getDeviceId()).isEqualTo(SENSOR_1);
    }

    @Test
    void shouldReturnEmptyWhenDeviceNotFound() {
        when(deviceRepository.findByDeviceId("ghost")).thenReturn(Optional.empty());

        Optional<DeviceDto> result = deviceService.getDeviceById("ghost");

        assertThat(result).isEmpty();
    }

    // ── deleteDevice ─────────────────────────────────────────────────────────────

    @Test
    void shouldDeleteExistingDevice() {
        Device d = buildDevice(SENSOR_1);
        when(deviceRepository.findByDeviceId(SENSOR_1)).thenReturn(Optional.of(d));

        deviceService.deleteDevice(SENSOR_1);

        verify(deviceRepository).delete(d);
    }

    @Test
    void shouldThrowWhenDeletingNonExistentDevice() {
        when(deviceRepository.findByDeviceId("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> deviceService.deleteDevice("ghost"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("ghost");
    }

    // ── setSimulated ─────────────────────────────────────────────────────────────

    @Test
    void shouldSetSimulated() {
        Device d = buildDevice(SENSOR_1);
        DeviceDto dto = buildDto(SENSOR_1);
        when(deviceRepository.findByDeviceId(SENSOR_1)).thenReturn(Optional.of(d));
        when(deviceRepository.save(d)).thenReturn(d);
        when(deviceMapper.toDto(d)).thenReturn(dto);

        DeviceDto result = deviceService.setSimulated(SENSOR_1, true);

        assertThat(d.isSimulated()).isTrue();
        assertThat(result).isNotNull();
    }

    @Test
    void shouldThrowWhenSettingSimulatedOnNonExistentDevice() {
        when(deviceRepository.findByDeviceId("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> deviceService.setSimulated("ghost", true))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ── updateLocation ────────────────────────────────────────────────────────────

    @Test
    void shouldUpdateDeviceLocation() {
        Device d = buildDevice(SENSOR_1);
        DeviceDto dto = buildDto(SENSOR_1);
        when(deviceRepository.findByDeviceId(SENSOR_1)).thenReturn(Optional.of(d));
        when(deviceRepository.save(d)).thenReturn(d);
        when(deviceMapper.toDto(d)).thenReturn(dto);

        deviceService.updateLocation(SENSOR_1, 40.4, -3.7);

        assertThat(d.getLatitude()).isEqualTo(40.4);
        assertThat(d.getLongitude()).isEqualTo(-3.7);
    }

    @Test
    void shouldClearDeviceLocation() {
        Device d = buildDevice(SENSOR_1);
        d.setLatitude(40.4);
        d.setLongitude(-3.7);
        DeviceDto dto = buildDto(SENSOR_1);
        when(deviceRepository.findByDeviceId(SENSOR_1)).thenReturn(Optional.of(d));
        when(deviceRepository.save(d)).thenReturn(d);
        when(deviceMapper.toDto(d)).thenReturn(dto);

        deviceService.updateLocation(SENSOR_1, null, null);

        assertThat(d.getLatitude()).isNull();
        assertThat(d.getLongitude()).isNull();
    }

    @Test
    void shouldThrowWhenUpdatingLocationOfNonExistentDevice() {
        when(deviceRepository.findByDeviceId("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> deviceService.updateLocation("ghost", 1.0, 1.0))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ── getDevicesForMap ──────────────────────────────────────────────────────────

    @Test
    void shouldReturnDevicesForMapWithAreaName() {
        UUID deviceUUID = UUID.randomUUID();
        Device d = Device.builder().id(deviceUUID).deviceId(SENSOR_1).type("TEMP").status("ACTIVE").build();
        Area area = Area.builder().id(UUID.randomUUID()).name("Zone A")
                .devices(new ArrayList<>(List.of(d))).build();

        when(deviceRepository.findAll()).thenReturn(List.of(d));
        when(areaRepository.findAllWithDevices()).thenReturn(List.of(area));

        List<DeviceMapDto> result = deviceService.getDevicesForMap();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getDeviceId()).isEqualTo(SENSOR_1);
        assertThat(result.get(0).getAreaName()).isEqualTo("Zone A");
    }

    @Test
    void shouldReturnDevicesForMapWithNoAreaWhenUnassigned() {
        Device d = buildDevice(SENSOR_1);
        when(deviceRepository.findAll()).thenReturn(List.of(d));
        when(areaRepository.findAllWithDevices()).thenReturn(List.of());

        List<DeviceMapDto> result = deviceService.getDevicesForMap();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getAreaName()).isNull();
    }

    @Test
    void shouldUseFirstAreaWhenDeviceBelongsToMultiple() {
        Device d = buildDevice(SENSOR_1);

        Area area1 = Area.builder().id(UUID.randomUUID()).name("First Area")
                .devices(new ArrayList<>(List.of(d))).build();

        Area area2 = Area.builder().id(UUID.randomUUID()).name("Second Area")
                .devices(new ArrayList<>(List.of(d))).build();

        when(deviceRepository.findAll()).thenReturn(List.of(d));
        when(areaRepository.findAllWithDevices()).thenReturn(List.of(area1, area2));

        List<DeviceMapDto> result = deviceService.getDevicesForMap();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getAreaName()).isIn("First Area", "Second Area");
    }

    @Test
    void shouldRejectLocationWithOnlyOneCoordinate() {
        assertThatThrownBy(() -> deviceService.updateLocation(SENSOR_1, 40.4, null))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> deviceService.updateLocation(SENSOR_1, null, -3.7))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void shouldRejectOutOfRangeCoordinates() {
        assertThatThrownBy(() -> deviceService.updateLocation(SENSOR_1, 91.0, 0.0))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("latitude");
        assertThatThrownBy(() -> deviceService.updateLocation(SENSOR_1, 0.0, -181.0))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("longitude");
    }
}
