package com.franciscobalonero.iotplatform.processing.repository;

import com.franciscobalonero.iotplatform.processing.model.IdempotencyRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

/**
 * Repository interface for IdempotencyRecord entities.
 *
 * @author Francisco Balonero Olivera
 */
@Repository
public interface IdempotencyRecordRepository extends JpaRepository<IdempotencyRecord, UUID> {
}
