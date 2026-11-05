package com.franciscobalonero.iotplatform.device.model;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Unit tests for {@link PolygonConverter}.
 */
class PolygonConverterTest {

    private final PolygonConverter converter = new PolygonConverter();

    private static final List<List<Double>> TRIANGLE =
            List.of(List.of(40.0, -3.0), List.of(40.1, -3.0), List.of(40.1, -3.1));

    // ── convertToDatabaseColumn ───────────────────────────────────────────────────

    @Test
    void shouldSerializeNullToEmptyJsonArray() {
        String result = converter.convertToDatabaseColumn(null);
        assertThat(result).isEqualTo("[]");
    }

    @Test
    void shouldSerializePolygonToJson() {
        String result = converter.convertToDatabaseColumn(TRIANGLE);
        assertThat(result).contains("40.0").contains("-3.0");
    }

    @Test
    void shouldSerializeEmptyListToEmptyJsonArray() {
        String result = converter.convertToDatabaseColumn(List.of());
        assertThat(result).isEqualTo("[]");
    }

    // ── convertToEntityAttribute ──────────────────────────────────────────────────

    @Test
    void shouldDeserializeValidJson() {
        String json = "[[40.0,-3.0],[40.1,-3.0],[40.1,-3.1]]";
        List<List<Double>> result = converter.convertToEntityAttribute(json);
        assertThat(result).hasSize(3);
        assertThat(result.get(0)).containsExactly(40.0, -3.0);
    }

    @Test
    void shouldReturnEmptyListForNullDbData() {
        List<List<Double>> result = converter.convertToEntityAttribute(null);
        assertThat(result).isEmpty();
    }

    @Test
    void shouldReturnEmptyListForBlankDbData() {
        List<List<Double>> result = converter.convertToEntityAttribute("   ");
        assertThat(result).isEmpty();
    }

    @Test
    void shouldReturnEmptyListForEmptyJsonArray() {
        List<List<Double>> result = converter.convertToEntityAttribute("[]");
        assertThat(result).isEmpty();
    }

    @Test
    void shouldThrowForInvalidJson() {
        assertThatThrownBy(() -> converter.convertToEntityAttribute("NOT_JSON"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Cannot deserialise polygon");
    }

    @Test
    void shouldRoundTripPolygon() {
        String serialised = converter.convertToDatabaseColumn(TRIANGLE);
        List<List<Double>> restored = converter.convertToEntityAttribute(serialised);
        assertThat(restored).hasSize(3);
        assertThat(restored.get(0)).containsExactly(40.0, -3.0);
    }
}
