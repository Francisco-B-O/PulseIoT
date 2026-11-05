package com.franciscobalonero.iotplatform.ingestion;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * Main application class for the Ingestion Service.
 * This service handles the entry point for raw telemetry data from devices.
 *
 * @author Francisco Balonero Olivera
 */
@SpringBootApplication(scanBasePackages = "com.franciscobalonero.iotplatform")
@EnableDiscoveryClient
public class IngestionServiceApplication {

    /**
     * Entry point for the Ingestion Service application.
     *
     * @param args Command-line arguments.
     */
    public static void main(String[] args) {
        SpringApplication.run(IngestionServiceApplication.class, args);
    }
}
