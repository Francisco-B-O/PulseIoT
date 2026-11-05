package com.franciscobalonero.iotplatform.gateway.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;

/**
 * Proxies the Eureka discovery service health endpoint through the gateway
 * to avoid CORS issues when the frontend calls it directly.
 */
@RestController
@RequestMapping("/api/v1/discovery")
public class DiscoveryHealthController {

    private final WebClient webClient;

    public DiscoveryHealthController(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.baseUrl("http://discovery-service:8761").build();
    }

    @GetMapping("/health")
    public Mono<Map> health() {
        return webClient.get()
                .uri("/actuator/health")
                .retrieve()
                .bodyToMono(Map.class);
    }
}
