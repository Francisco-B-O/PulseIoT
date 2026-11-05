package com.franciscobalonero.iotplatform.device.mapper;

import com.franciscobalonero.iotplatform.device.dto.CreateDeviceRequest;
import com.franciscobalonero.iotplatform.device.dto.DeviceDto;
import com.franciscobalonero.iotplatform.device.model.Device;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;

/**
 * MapStruct mapper for converting between {@link Device} entity and its DTOs.
 * Handles the mapping of device registration requests and responses.
 *
 * @author Francisco Balonero Olivera
 */
@Mapper(componentModel = "spring")
public interface DeviceMapper {

    /**
     * Converts a Device entity to a DeviceDto.
     *
     * @param device The device entity to convert.
     * @return The corresponding device DTO.
     */
    DeviceDto toDto(Device device);

    /**
     * Converts a CreateDeviceRequest to a Device entity.
     * Fields like id, status, and createdAt are ignored as they are handled by the system.
     *
     * @param request The creation request.
     * @return The device entity.
     */
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "status", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    Device toEntity(CreateDeviceRequest request);

    /**
     * Converts a list of Device entities to a list of DeviceDtos.
     *
     * @param devices The list of device entities.
     * @return The list of device DTOs.
     */
    List<DeviceDto> toDtoList(List<Device> devices);
}
