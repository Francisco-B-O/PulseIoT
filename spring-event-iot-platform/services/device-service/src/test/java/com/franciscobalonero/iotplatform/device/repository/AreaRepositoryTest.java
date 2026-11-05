package com.franciscobalonero.iotplatform.device.repository;

import com.franciscobalonero.iotplatform.device.model.Area;
import com.franciscobalonero.iotplatform.device.model.Device;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for {@link AreaRepository} using @DataJpaTest.
 */
@DataJpaTest
class AreaRepositoryTest {

    @Autowired
    private AreaRepository areaRepository;

    @Autowired
    private DeviceRepository deviceRepository;

    private Area buildArea(String name) {
        return Area.builder()
                .name(name)
                .polygon(List.of(List.of(40.0, -3.0), List.of(40.1, -3.0), List.of(40.1, -3.1)))
                .build();
    }

    @Test
    void shouldSaveAndFindArea() {
        Area saved = areaRepository.save(buildArea("Zone A"));

        Optional<Area> found = areaRepository.findById(saved.getId());

        assertThat(found).isPresent();
        assertThat(found.get().getName()).isEqualTo("Zone A");
    }

    @Test
    void shouldPersistPolygonCoordinates() {
        Area area = buildArea("Test Zone");
        area = areaRepository.save(area);

        Area loaded = areaRepository.findById(area.getId()).orElseThrow();
        assertThat(loaded.getPolygon()).hasSize(3);
        assertThat(loaded.getPolygon().get(0)).containsExactly(40.0, -3.0);
    }

    @Test
    void shouldSetCreatedAtAutomatically() {
        Area area = areaRepository.save(buildArea("Auto-Date Zone"));
        assertThat(area.getCreatedAt()).isNotNull().isBeforeOrEqualTo(LocalDateTime.now());
    }

    @Test
    void shouldFindAllWithDevices() {
        Device device = deviceRepository.save(Device.builder()
                .deviceId("map-device-1")
                .type("SENSOR")
                .status("ACTIVE")
                .createdAt(LocalDateTime.now())
                .build());

        Area area = buildArea("Device Zone");
        area.getDevices().add(device);
        areaRepository.save(area);

        List<Area> areas = areaRepository.findAllWithDevices();
        assertThat(areas).isNotEmpty();
        Area found = areas.stream()
                .filter(a -> "Device Zone".equals(a.getName()))
                .findFirst()
                .orElseThrow();
        assertThat(found.getDevices()).hasSize(1);
        assertThat(found.getDevices().get(0).getDeviceId()).isEqualTo("map-device-1");
    }

    @Test
    void shouldDeleteArea() {
        Area area = areaRepository.save(buildArea("Temp Zone"));
        areaRepository.delete(area);
        assertThat(areaRepository.findById(area.getId())).isEmpty();
    }
}
