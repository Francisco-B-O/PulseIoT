package com.franciscobalonero.iotplatform.device.model;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Collections;
import java.util.List;

/**
 * JPA AttributeConverter that serialises a polygon (list of [lat, lng] coordinate pairs)
 * to/from a JSON TEXT column.
 */
@Converter
public class PolygonConverter implements AttributeConverter<List<List<Double>>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<List<Double>>> TYPE_REF = new TypeReference<>() {};

    @Override
    public String convertToDatabaseColumn(List<List<Double>> attribute) {
        if (attribute == null) return "[]";
        try {
            return MAPPER.writeValueAsString(attribute);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Cannot serialise polygon to JSON", e);
        }
    }

    @Override
    public List<List<Double>> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) return Collections.emptyList();
        try {
            return MAPPER.readValue(dbData, TYPE_REF);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Cannot deserialise polygon from JSON: " + dbData, e);
        }
    }
}
