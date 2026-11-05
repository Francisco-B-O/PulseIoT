package com.franciscobalonero.iotplatform.device.repository;

import com.franciscobalonero.iotplatform.device.model.Device;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Repository interface for {@link Device} entities.
 * Provides access to device data in the database, including lookup by business device ID.
 *
 * @author Francisco Balonero Olivera
 */
@Repository
public interface DeviceRepository extends JpaRepository<Device, UUID> {
    /**
     * Finds a device by its unique business device identifier.
     *
     * @param deviceId The business device ID.
     * @return An optional containing the device if found.
     */
    Optional<Device> findByDeviceId(String deviceId);

    /**
     * Finds all devices marked as simulated.
     *
     * @return A list of simulated devices.
     */
    List<Device> findBySimulatedTrue();
}
