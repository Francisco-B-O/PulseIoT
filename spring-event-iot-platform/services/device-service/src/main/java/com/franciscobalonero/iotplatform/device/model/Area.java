package com.franciscobalonero.iotplatform.device.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Entity representing a named geographic area (polygon) on the IoT map.
 * Devices can be assigned to one or more areas for grouping and filtering.
 */
@Entity
@Table(name = "areas")
@Getter
@Setter
@EqualsAndHashCode(of = "id")
@ToString(exclude = "devices")
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Area {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String name;

    /**
     * Polygon as a list of [latitude, longitude] coordinate pairs.
     * Stored as JSON text in the database via {@link PolygonConverter}.
     */
    @Column(columnDefinition = "TEXT", nullable = false)
    @Convert(converter = PolygonConverter.class)
    private List<List<Double>> polygon;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    /**
     * Devices that belong to this area.
     * Many-to-many: an area can contain many devices; a device can be in multiple areas.
     */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "area_devices",
            joinColumns = @JoinColumn(name = "area_id"),
            inverseJoinColumns = @JoinColumn(name = "device_id")
    )
    @Builder.Default
    private List<Device> devices = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
