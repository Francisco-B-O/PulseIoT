package com.franciscobalonero.iotplatform.device.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.franciscobalonero.iotplatform.device.dto.AreaRequest;
import com.franciscobalonero.iotplatform.device.dto.AreaResponse;
import com.franciscobalonero.iotplatform.device.service.AreaService;
import com.franciscobalonero.iotplatform.common.exception.ResourceNotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Web layer tests for {@link AreaController}.
 */
@WebMvcTest(AreaController.class)
class AreaControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AreaService areaService;

    private static final String ZONE_A    = "Zone A";
    private static final String NEW_ZONE  = "New Zone";
    private static final String AREAS_URL = "/api/v1/areas";
    private static final String AREAS_ID_URL = "/api/v1/areas/";
    private static final String SENSOR_01 = "sensor-01";

    private static final List<List<Double>> POLYGON =
            List.of(List.of(40.0, -3.0), List.of(40.1, -3.0), List.of(40.1, -3.1));

    @Test
    void shouldReturnAllAreas() throws Exception {
        AreaResponse area = AreaResponse.builder()
                .id(UUID.randomUUID()).name(ZONE_A).polygon(POLYGON).deviceCount(2)
                .deviceIds(List.of("d1", "d2"))
                .build();
        when(areaService.getAllAreas()).thenReturn(List.of(area));

        mockMvc.perform(get(AREAS_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value(ZONE_A))
                .andExpect(jsonPath("$[0].deviceCount").value(2));
    }

    @Test
    void shouldCreateArea() throws Exception {
        AreaRequest request = new AreaRequest(NEW_ZONE, POLYGON);
        AreaResponse response = AreaResponse.builder()
                .id(UUID.randomUUID()).name(NEW_ZONE).polygon(POLYGON).deviceCount(0)
                .build();
        when(areaService.createArea(any())).thenReturn(response);

        mockMvc.perform(post(AREAS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value(NEW_ZONE));
    }

    @Test
    void shouldRejectCreateAreaWithoutName() throws Exception {
        String body = objectMapper.writeValueAsString(new AreaRequest("", POLYGON));

        mockMvc.perform(post(AREAS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldRejectCreateAreaWithTooFewPoints() throws Exception {
        AreaRequest request = new AreaRequest("Bad Zone", List.of(List.of(40.0, -3.0)));
        mockMvc.perform(post(AREAS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldDeleteArea() throws Exception {
        UUID id = UUID.randomUUID();
        doNothing().when(areaService).deleteArea(id);

        mockMvc.perform(delete(AREAS_ID_URL + id))
                .andExpect(status().isNoContent());

        verify(areaService).deleteArea(id);
    }

    @Test
    void shouldReturn404WhenDeletingNonExistentArea() throws Exception {
        UUID id = UUID.randomUUID();
        doThrow(new ResourceNotFoundException("Area " + id + " not found"))
                .when(areaService).deleteArea(id);

        mockMvc.perform(delete(AREAS_ID_URL + id))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldUpdateAreaPolygon() throws Exception {
        UUID id = UUID.randomUUID();
        AreaRequest request = new AreaRequest(ZONE_A, POLYGON);
        AreaResponse response = AreaResponse.builder()
                .id(id).name(ZONE_A).polygon(POLYGON).deviceCount(0).build();
        when(areaService.updatePolygon(eq(id), any())).thenReturn(response);

        mockMvc.perform(patch(AREAS_ID_URL + id + "/polygon")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value(ZONE_A));
    }

    @Test
    void shouldRejectCreateAreaWithInvalidCoordinatePairs() throws Exception {
        // Each point must have exactly 2 elements — sending a 1-element point
        AreaRequest request = new AreaRequest("Bad Zone",
                List.of(List.of(40.0), List.of(40.1, -3.0), List.of(40.2, -3.1)));
        mockMvc.perform(post(AREAS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldAssignDeviceToArea() throws Exception {
        UUID areaId = UUID.randomUUID();
        AreaResponse response = AreaResponse.builder()
                .id(areaId).name("Zone").polygon(POLYGON).deviceCount(1)
                .deviceIds(List.of(SENSOR_01))
                .build();
        when(areaService.assignDevice(eq(areaId), eq(SENSOR_01))).thenReturn(response);

        mockMvc.perform(post(AREAS_ID_URL + areaId + "/devices/" + SENSOR_01))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deviceCount").value(1))
                .andExpect(jsonPath("$.deviceIds[0]").value(SENSOR_01));
    }
}
