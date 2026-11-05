package com.franciscobalonero.iotplatform.alert.mapper;

import com.franciscobalonero.iotplatform.alert.dto.AlertDto;
import com.franciscobalonero.iotplatform.alert.model.Alert;
import org.mapstruct.Mapper;

import java.util.List;

/**
 * MapStruct mapper for converting between {@link Alert} entity and its DTOs.
 *
 * @author Francisco Balonero Olivera
 */
@Mapper(componentModel = "spring")
public interface AlertMapper {

    /**
     * Converts an Alert entity to an AlertDto.
     *
     * @param alert The alert entity.
     * @return The alert DTO.
     */
    AlertDto toDto(Alert alert);

    /**
     * Converts a list of Alert entities to a list of AlertDtos.
     *
     * @param alerts The list of alert entities.
     * @return The list of alert DTOs.
     */
    List<AlertDto> toDtoList(List<Alert> alerts);
}
