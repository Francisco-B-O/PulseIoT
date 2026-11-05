package com.franciscobalonero.iotplatform.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * Main application class for the Gateway Service.
 * Acts as the entry point for all external requests, providing routing and cross-cutting concerns.
 *
 * @author Francisco Balonero Olivera
 */
@SpringBootApplication
@EnableDiscoveryClient
public class GatewayServiceApplication {

    /**
     * Entry point for the Gateway Service application.
     *
     * @param args Command-line arguments.
     */
    public static void main(String[] args) {
        SpringApplication.run(GatewayServiceApplication.class, args);
    }
}
