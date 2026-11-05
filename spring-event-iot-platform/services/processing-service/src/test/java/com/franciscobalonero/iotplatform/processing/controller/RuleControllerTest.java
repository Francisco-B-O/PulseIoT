package com.franciscobalonero.iotplatform.processing.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.franciscobalonero.iotplatform.processing.service.RuleService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Web layer tests for {@link RuleController}.
 */
@WebMvcTest(RuleController.class)
class RuleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private RuleService ruleService;

    private static final String THRESHOLD_URL = "/api/v1/rules/temperature";

    @Test
    void shouldReturnCurrentThreshold() throws Exception {
        when(ruleService.getTemperatureThreshold()).thenReturn(95.0);

        mockMvc.perform(get(THRESHOLD_URL))
                .andExpect(status().isOk())
                .andExpect(content().string("95.0"));
    }

    @Test
    void shouldUpdateThreshold() throws Exception {
        ThresholdRequest request = new ThresholdRequest(85.0);

        mockMvc.perform(post(THRESHOLD_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk());

        verify(ruleService).updateTemperatureThreshold(85.0);
    }
}
