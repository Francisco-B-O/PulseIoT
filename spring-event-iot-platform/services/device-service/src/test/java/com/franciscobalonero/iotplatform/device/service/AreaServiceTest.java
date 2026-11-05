package com.franciscobalonero.iotplatform.device.service;

import com.franciscobalonero.iotplatform.device.dto.AreaRequest;
import com.franciscobalonero.iotplatform.device.dto.AreaResponse;
import com.franciscobalonero.iotplatform.device.mapper.AreaMapper;
import com.franciscobalonero.iotplatform.device.model.Area;
import com.franciscobalonero.iotplatform.device.model.Device;
import com.franciscobalonero.iotplatform.device.repository.AreaRepository;
import com.franciscobalonero.iotplatform.device.repository.DeviceRepository;
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
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link AreaService}.
 */
@ExtendWith(MockitoExtension.class)
class AreaServiceTest {

    @Mock
    private AreaRepository areaRepository;

    @Mock
    private DeviceRepository deviceRepository;

    @Mock
    private AreaMapper areaMapper;

    @InjectMocks
    private AreaService areaService;

    private static final String ZONE_A     = "Zone A";
    private static final String SENSOR_99  = "sensor-99";
    private static final String DUP_SENSOR = "dup-sensor";
    private static final String GHOST      = "ghost";

    private static final List<List<Double>> POLYGON =
            List.of(List.of(40.0, -3.0), List.of(40.1, -3.0), List.of(40.1, -3.1));

    @Test
    void shouldCreateArea() {
        AreaRequest request = new AreaRequest(ZONE_A, POLYGON);

        Area entity = Area.builder().id(UUID.randomUUID()).name(ZONE_A).polygon(POLYGON).build();
        AreaResponse baseResponse = AreaResponse.builder().id(entity.getId()).name(ZONE_A).polygon(POLYGON).build();

        when(areaMapper.toEntity(request)).thenReturn(entity);
        when(areaRepository.save(any())).thenReturn(entity);
        when(areaMapper.toResponse(entity)).thenReturn(baseResponse);

        AreaResponse result = areaService.createArea(request);

        assertThat(result.getName()).isEqualTo(ZONE_A);
        verify(areaRepository).save(entity);
    }

    @Test
    void shouldReturnAllAreasWithDeviceCount() {
        Device dev = Device.builder().id(UUID.randomUUID()).deviceId("d1").build();
        Area area = Area.builder()
                .id(UUID.randomUUID()).name("Zone B").polygon(POLYGON)
                .devices(new ArrayList<>(List.of(dev)))
                .build();
        AreaResponse baseResponse = AreaResponse.builder().id(area.getId()).name("Zone B").polygon(POLYGON).build();

        when(areaRepository.findAllWithDevices()).thenReturn(List.of(area));
        when(areaMapper.toResponse(area)).thenReturn(baseResponse);

        List<AreaResponse> result = areaService.getAllAreas();

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getDeviceCount()).isEqualTo(1);
        assertThat(result.get(0).getDeviceIds()).containsExactly("d1");
    }

    @Test
    void shouldDeleteAreaSuccessfully() {
        UUID id = UUID.randomUUID();
        Area area = Area.builder().id(id).name("Delete Zone").polygon(POLYGON).build();

        when(areaRepository.findById(id)).thenReturn(Optional.of(area));

        areaService.deleteArea(id);

        verify(areaRepository).delete(area);
    }

    @Test
    void shouldThrowWhenDeletingNonExistentArea() {
        UUID id = UUID.randomUUID();
        when(areaRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> areaService.deleteArea(id))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining(id.toString());
    }

    @Test
    void shouldAssignDeviceToArea() {
        UUID areaId = UUID.randomUUID();
        Area area = Area.builder()
                .id(areaId).name("Assign Zone").polygon(POLYGON)
                .devices(new ArrayList<>())
                .build();
        Device device = Device.builder().id(UUID.randomUUID()).deviceId(SENSOR_99).build();
        AreaResponse baseResponse = AreaResponse.builder().id(areaId).name("Assign Zone").polygon(POLYGON).build();

        when(areaRepository.findById(areaId)).thenReturn(Optional.of(area));
        when(deviceRepository.findByDeviceId(SENSOR_99)).thenReturn(Optional.of(device));
        when(areaRepository.save(any())).thenReturn(area);
        when(areaMapper.toResponse(any())).thenReturn(baseResponse);

        AreaResponse result = areaService.assignDevice(areaId, SENSOR_99);

        assertThat(area.getDevices()).contains(device);
        assertThat(result).isNotNull();
    }

    @Test
    void shouldNotDuplicateDeviceOnReassignment() {
        UUID areaId = UUID.randomUUID();
        Device device = Device.builder().id(UUID.randomUUID()).deviceId(DUP_SENSOR).build();
        Area area = Area.builder()
                .id(areaId).name("Dup Zone").polygon(POLYGON)
                .devices(new ArrayList<>(List.of(device)))
                .build();
        AreaResponse baseResponse = AreaResponse.builder().id(areaId).build();

        when(areaRepository.findById(areaId)).thenReturn(Optional.of(area));
        when(deviceRepository.findByDeviceId(DUP_SENSOR)).thenReturn(Optional.of(device));
        when(areaMapper.toResponse(any())).thenReturn(baseResponse);

        areaService.assignDevice(areaId, DUP_SENSOR);

        assertThat(area.getDevices()).hasSize(1);   // still one, not two
        verify(areaRepository, never()).save(any()); // no save needed
    }

    @Test
    void shouldUpdatePolygon() {
        UUID id = UUID.randomUUID();
        List<List<Double>> newPoly = List.of(List.of(41.0, -4.0), List.of(41.1, -4.0), List.of(41.1, -4.1));
        Area area = Area.builder().id(id).name("Zone").polygon(POLYGON).devices(new ArrayList<>()).build();
        AreaRequest request = new AreaRequest("Zone", newPoly);

        when(areaRepository.findById(id)).thenReturn(Optional.of(area));
        when(areaRepository.save(area)).thenReturn(area);
        when(areaMapper.toResponse(area)).thenReturn(AreaResponse.builder().id(id).name("Zone").polygon(newPoly).deviceCount(0).build());

        AreaResponse result = areaService.updatePolygon(id, request);

        assertThat(area.getPolygon()).isEqualTo(newPoly);   // polygon mutated
        assertThat(result.getPolygon()).isEqualTo(newPoly);
        verify(areaRepository).save(area);
    }

    @Test
    void shouldThrowWhenUpdatingPolygonOfNonExistentArea() {
        UUID id = UUID.randomUUID();
        when(areaRepository.findById(id)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> areaService.updatePolygon(id, new AreaRequest("X", POLYGON)))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void shouldThrowWhenAssigningDeviceToNonExistentArea() {
        UUID areaId = UUID.randomUUID();
        when(areaRepository.findById(areaId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> areaService.assignDevice(areaId, "any-device"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void shouldThrowWhenAssigningNonExistentDevice() {
        UUID areaId = UUID.randomUUID();
        Area area = Area.builder().id(areaId).name("Z").polygon(POLYGON).devices(new ArrayList<>()).build();

        when(areaRepository.findById(areaId)).thenReturn(Optional.of(area));
        when(deviceRepository.findByDeviceId(GHOST)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> areaService.assignDevice(areaId, GHOST))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining(GHOST);
    }
}
