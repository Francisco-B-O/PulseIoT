package com.franciscobalonero.iotplatform.alert.repository;

import com.franciscobalonero.iotplatform.alert.model.Alert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/**
 * Repository interface for {@link Alert} entities.
 * Provides standard CRUD operations and custom query methods for managing alerts in the database.
 *
 * @author Francisco Balonero Olivera
 */
@Repository
public interface AlertRepository extends JpaRepository<Alert, UUID> {

    /** Marks every pending alert as acknowledged in a single statement. */
    @Modifying
    @Query("UPDATE Alert a SET a.acknowledged = true WHERE a.acknowledged = false")
    int acknowledgeAllPending();
}
