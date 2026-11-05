package com.franciscobalonero.iotplatform.device.repository;

import com.franciscobalonero.iotplatform.device.model.Device;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for {@link DeviceRepository} using @DataJpaTest.
 * Verifies that the repository correctly handles persistence and retrieval of {@link Device} entities.
 *
 * @author Francisco Balonero Olivera
 */
@DataJpaTest
class DeviceRepositoryTest {

    @Autowired
    private DeviceRepository deviceRepository;

    /**
     * Verifies that a device can be saved and then retrieved by its business device identifier.
     */
    @Test
    void shouldSaveAndFindByDeviceId() {
        Device device = Device.builder()
                .deviceId("test-device")
                .type("SENSOR")
                .status("ACTIVE")
                .createdAt(LocalDateTime.now())
                .build();

        deviceRepository.save(device);

        Optional<Device> found = deviceRepository.findByDeviceId("test-device");

        assertThat(found).isPresent();
        assertThat(found.get().getType()).isEqualTo("SENSOR");
    }
}
