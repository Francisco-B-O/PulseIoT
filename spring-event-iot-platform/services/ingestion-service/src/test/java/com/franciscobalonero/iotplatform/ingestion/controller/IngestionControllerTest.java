package com.franciscobalonero.iotplatform.ingestion.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.franciscobalonero.iotplatform.ingestion.dto.TelemetryRequest;
import com.franciscobalonero.iotplatform.ingestion.service.IngestionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Unit tests for {@link IngestionController}.
 * Uses MockMvc to verify that telemetry requests are correctly accepted.
 *
 * @author Francisco Balonero Olivera
 */
@WebMvcTest(IngestionController.class)
class IngestionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private IngestionService ingestionService;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Verifies that a valid telemetry request returns an "Accepted" status.
     *
     * @throws Exception if the request processing fails.
     */
    @Test
    void shouldAcceptTelemetry() throws Exception {
        TelemetryRequest request = TelemetryRequest.builder()
                .deviceId("sensor-1")
                .payload(Map.of("temp", 25.0))
                .build();

        doNothing().when(ingestionService).processTelemetry(any());

        mockMvc.perform(post("/api/v1/telemetry")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isAccepted());
    }
}
