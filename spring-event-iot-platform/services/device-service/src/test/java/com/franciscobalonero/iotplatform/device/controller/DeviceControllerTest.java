package com.franciscobalonero.iotplatform.device.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.franciscobalonero.iotplatform.device.dto.CreateDeviceRequest;
import com.franciscobalonero.iotplatform.device.dto.DeviceDto;
import com.franciscobalonero.iotplatform.device.dto.DeviceMapDto;
import com.franciscobalonero.iotplatform.device.service.DeviceService;
import com.franciscobalonero.iotplatform.common.exception.ResourceNotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Web layer tests for {@link DeviceController}.
 */
@WebMvcTest(DeviceController.class)
class DeviceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private DeviceService deviceService;

    private static final String BASE_URL = "/api/v1/devices";
    private static final String SENSOR_1 = "sensor-1";

    private DeviceDto dto(String deviceId) {
        return DeviceDto.builder().id(UUID.randomUUID()).deviceId(deviceId).type("TEMP").status("ACTIVE").build();
    }

    // ── GET /devices ──────────────────────────────────────────────────────────────

    @Test
    void shouldReturnAllDevices() throws Exception {
        when(deviceService.getAllDevices()).thenReturn(List.of(dto(SENSOR_1)));

        mockMvc.perform(get(BASE_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].deviceId").value(SENSOR_1));
    }

    // ── GET /devices/map ──────────────────────────────────────────────────────────

    @Test
    void shouldReturnDevicesForMap() throws Exception {
        DeviceMapDto mapDto = DeviceMapDto.builder().deviceId(SENSOR_1).type("TEMP").status("ACTIVE").build();
        when(deviceService.getDevicesForMap()).thenReturn(List.of(mapDto));

        mockMvc.perform(get(BASE_URL + "/map"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].deviceId").value(SENSOR_1));
    }

    // ── GET /devices/{id} ─────────────────────────────────────────────────────────

    @Test
    void shouldReturnDeviceById() throws Exception {
        when(deviceService.getDeviceById(SENSOR_1)).thenReturn(Optional.of(dto(SENSOR_1)));

        mockMvc.perform(get(BASE_URL + "/" + SENSOR_1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deviceId").value(SENSOR_1));
    }

    @Test
    void shouldReturn404WhenDeviceNotFound() throws Exception {
        when(deviceService.getDeviceById("ghost")).thenReturn(Optional.empty());

        mockMvc.perform(get(BASE_URL + "/ghost"))
                .andExpect(status().isNotFound());
    }

    // ── POST /devices ─────────────────────────────────────────────────────────────

    @Test
    void shouldCreateDevice() throws Exception {
        CreateDeviceRequest req = CreateDeviceRequest.builder().deviceId(SENSOR_1).type("TEMP").build();
        when(deviceService.createDevice(any())).thenReturn(dto(SENSOR_1));

        mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.deviceId").value(SENSOR_1));
    }

    // ── DELETE /devices/{id} ──────────────────────────────────────────────────────

    @Test
    void shouldDeleteDevice() throws Exception {
        doNothing().when(deviceService).deleteDevice(SENSOR_1);

        mockMvc.perform(delete(BASE_URL + "/" + SENSOR_1))
                .andExpect(status().isNoContent());
    }

    @Test
    void shouldReturn404WhenDeletingNonExistentDevice() throws Exception {
        doThrow(new ResourceNotFoundException("Device not found"))
                .when(deviceService).deleteDevice("ghost");

        mockMvc.perform(delete(BASE_URL + "/ghost"))
                .andExpect(status().isNotFound());
    }

    // ── PATCH /devices/{id}/simulate ──────────────────────────────────────────────

    @Test
    void shouldSetSimulated() throws Exception {
        when(deviceService.setSimulated(eq(SENSOR_1), anyBoolean())).thenReturn(dto(SENSOR_1));

        mockMvc.perform(patch(BASE_URL + "/" + SENSOR_1 + "/simulate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("simulated", true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deviceId").value(SENSOR_1));
    }

    // ── PATCH /devices/{id}/location ──────────────────────────────────────────────

    @Test
    void shouldUpdateLocation() throws Exception {
        when(deviceService.updateLocation(eq(SENSOR_1), any(), any())).thenReturn(dto(SENSOR_1));

        mockMvc.perform(patch(BASE_URL + "/" + SENSOR_1 + "/location")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("latitude", 40.4, "longitude", -3.7))))
                .andExpect(status().isOk());
    }
}
