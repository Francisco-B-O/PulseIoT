package com.franciscobalonero.iotplatform.alert.repository;

import com.franciscobalonero.iotplatform.alert.model.IdempotencyRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/**
 * Repository interface for {@link IdempotencyRecord} entities.
 * Provides standard CRUD operations for managing idempotency records in the database.
 *
 * @author Francisco Balonero Olivera
 */
@Repository
public interface IdempotencyRecordRepository extends JpaRepository<IdempotencyRecord, UUID> {
}
