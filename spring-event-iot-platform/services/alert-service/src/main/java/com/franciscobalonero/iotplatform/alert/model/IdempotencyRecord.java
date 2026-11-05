package com.franciscobalonero.iotplatform.alert.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * Entity representing an idempotency record for event processing.
 * This class captures the unique identifier of the event and the time it was processed.
 *
 * @author Francisco Balonero Olivera
 */
@Entity
@Table(name = "idempotency_records")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IdempotencyRecord {

    /**
     * Unique identifier for the event that was processed.
     */
    @Id
    @Column(name = "event_id")
    private UUID eventId;

    /**
     * The time when the event was processed.
     */
    @Column(name = "processed_at", nullable = false)
    private Instant processedAt;
}
