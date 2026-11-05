package com.franciscobalonero.iotplatform.device.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Request body for creating a geographic area.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AreaRequest {

    @NotBlank(message = "Area name is required")
    private String name;

    /**
     * Ordered list of [latitude, longitude] pairs forming a closed polygon.
     * Must contain at least 3 points.
     */
    @NotNull(message = "Polygon coordinates are required")
    @Size(min = 3, message = "A polygon requires at least 3 coordinate pairs")
    private List<List<Double>> polygon;

    @AssertTrue(message = "Each coordinate pair must have exactly 2 values [latitude, longitude]")
    private boolean isPolygonCoordinatesValid() {
        return polygon == null || polygon.stream().allMatch(p -> p != null && p.size() == 2);
    }
}
