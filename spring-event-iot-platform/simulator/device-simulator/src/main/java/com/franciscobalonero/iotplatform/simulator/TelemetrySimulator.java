package com.franciscobalonero.iotplatform.simulator;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.security.SecureRandom;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Component responsible for simulating IoT device telemetry data.
 * Fetches simulated devices dynamically and sends telemetry at regular intervals.
 *
 * @author Francisco Balonero Olivera
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TelemetrySimulator {

    private final RestTemplate restTemplate = new RestTemplate();
    private final SecureRandom random = new SecureRandom();

    /** Devices currently marked as simulated, refreshed periodically. */
    private final List<String> simulatedDevices = new CopyOnWriteArrayList<>();

    @Value("${simulator.gateway-url}")
    private String gatewayUrl;

    @Value("${simulator.auth-username:admin}")
    private String authUsername;

    @Value("${simulator.auth-password:admin123}")
    private String authPassword;

    private volatile String jwtToken;

    @EventListener(ApplicationReadyEvent.class)
    public void initializeAuth() {
        try {
            obtainJwtToken();
            log.info("Simulator: Authentication successful");
            refreshSimulatedDevices();
        } catch (Exception e) {
            log.error("Simulator: Failed to initialize: {}", e.getMessage());
        }
    }

    private void obtainJwtToken() {
        try {
            Map<String, String> loginRequest = Map.of(
                "username", authUsername,
                "password", authPassword
            );

            @SuppressWarnings("unchecked")
            Map<String, Object> response = restTemplate.postForObject(
                gatewayUrl + "/api/v1/auth/login",
                loginRequest,
                Map.class
            );

            if (response != null && response.containsKey("token")) {
                this.jwtToken = (String) response.get("token");
            } else {
                log.warn("Simulator: Token not found in login response");
            }
        } catch (Exception e) {
            log.error("Simulator: Error obtaining JWT token: {}", e.getMessage());
        }
    }

    /**
     * Periodically fetches the list of devices marked as simulated from the gateway.
     */
    @Scheduled(fixedDelay = 60000)
    public void refreshSimulatedDevices() {
        if (jwtToken == null) return;
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(jwtToken);
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<Map[]> response = restTemplate.exchange(
                gatewayUrl + "/api/v1/devices",
                HttpMethod.GET,
                entity,
                Map[].class
            );

            if (response.getBody() != null) {
                List<String> updated = Arrays.stream(response.getBody())
                    .filter(d -> Boolean.TRUE.equals(d.get("simulated")))
                    .map(d -> (String) d.get("deviceId"))
                    .toList();
                simulatedDevices.clear();
                simulatedDevices.addAll(updated);
                log.info("Simulator: {} simulated device(s): {}", simulatedDevices.size(), simulatedDevices);
            }
        } catch (Exception e) {
            log.warn("Simulator: Failed to refresh simulated devices: {}", e.getMessage());
            // Attempt re-auth if token expired
            if (e.getMessage() != null && e.getMessage().contains("401")) {
                obtainJwtToken();
            }
        }
    }

    /**
     * Scheduled task that generates and sends synthetic telemetry for all simulated devices.
     */
    @Scheduled(fixedDelayString = "${simulator.interval:5000}")
    public void simulate() {
        if (jwtToken == null) {
            log.info("Simulator: JWT token not available, attempting to authenticate...");
            obtainJwtToken();
            if (jwtToken == null) {
                log.warn("Simulator: Authentication failed, skipping telemetry");
                return;
            }
        }

        if (simulatedDevices.isEmpty()) {
            log.debug("Simulator: No simulated devices, skipping");
            return;
        }

        String deviceId = simulatedDevices.get(random.nextInt(simulatedDevices.size()));

        // Forced Anomaly Logic: every 5th message is a CRITICAL FAIL
        boolean isCritical = random.nextInt(5) == 0;

        double temperature = isCritical ? 120 + random.nextDouble() * 30 : 20 + (random.nextDouble() * 30);
        double humidity = 30 + (random.nextDouble() * 50);
        double vibration = isCritical ? 0.95 : random.nextDouble() * 0.1;

        TelemetryRequest request = new TelemetryRequest();
        request.setDeviceId(deviceId);
        request.setPayload(Map.of(
            "temperature", temperature,
            "humidity", humidity,
            "vibration", vibration,
            "deviceType", "THERMAL"
        ));
        log.info("Simulator: Sending telemetry for {} - Temp: {}C", deviceId, String.format("%.2f", temperature));

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(jwtToken);
            HttpEntity<TelemetryRequest> entity = new HttpEntity<>(request, headers);

            restTemplate.postForObject(gatewayUrl + "/api/v1/telemetry", entity, Void.class);
        } catch (Exception e) {
            log.error("Simulator: Failed to send telemetry: {}", e.getMessage());
            if (e.getMessage() != null && e.getMessage().contains("401")) {
                log.info("Simulator: Attempting to re-authenticate");
                obtainJwtToken();
            }
        }
    }
}
