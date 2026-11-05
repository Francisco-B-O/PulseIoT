package com.franciscobalonero.iotplatform.device.mapper;

import com.franciscobalonero.iotplatform.device.dto.AreaRequest;
import com.franciscobalonero.iotplatform.device.dto.AreaResponse;
import com.franciscobalonero.iotplatform.device.model.Area;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

/**
 * MapStruct mapper for {@link Area} entities and their DTOs.
 */
@Mapper(componentModel = "spring")
public interface AreaMapper {

    /**
     * Converts a creation request to an Area entity.
     * System-managed fields are ignored.
     */
    @Mapping(target = "id",        ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "devices",   ignore = true)
    Area toEntity(AreaRequest request);

    /**
     * Converts an Area entity to a response DTO.
     * {@code deviceCount} and {@code deviceIds} are computed in the service layer.
     */
    @Mapping(target = "deviceCount", ignore = true)
    @Mapping(target = "deviceIds",   ignore = true)
    AreaResponse toResponse(Area area);

    List<AreaResponse> toResponseList(List<Area> areas);
}
