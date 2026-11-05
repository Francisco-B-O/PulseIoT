package com.franciscobalonero.iotplatform.processing.model;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Entity for tracking processed events to ensure idempotency.
 *
 * @author Francisco Balonero Olivera
 */
@Entity
@Table(name = "processed_events")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IdempotencyRecord {
    @Id
    private UUID eventId;
    private Instant processedAt;
}
