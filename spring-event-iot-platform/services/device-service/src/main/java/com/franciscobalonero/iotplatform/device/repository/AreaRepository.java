package com.franciscobalonero.iotplatform.device.repository;

import com.franciscobalonero.iotplatform.device.model.Area;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

/**
 * Repository for {@link Area} entities.
 */
@Repository
public interface AreaRepository extends JpaRepository<Area, UUID> {

    /**
     * Loads all areas together with their device lists in a single query,
     * avoiding N+1 selects when building map responses.
     */
    @Query("SELECT DISTINCT a FROM Area a LEFT JOIN FETCH a.devices")
    List<Area> findAllWithDevices();
}
