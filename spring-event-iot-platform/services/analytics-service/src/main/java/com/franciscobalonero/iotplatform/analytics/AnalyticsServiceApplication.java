package com.franciscobalonero.iotplatform.analytics;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * Main application class for the Analytics Service.
 * This service provides real-time analytics and statistics for IoT devices.
 *
 * @author Francisco Balonero Olivera
 */
@SpringBootApplication(scanBasePackages = "com.franciscobalonero.iotplatform")
@EnableDiscoveryClient
public class AnalyticsServiceApplication {

    /**
     * Entry point for the Analytics Service application.
     *
     * @param args Command-line arguments.
     */
    public static void main(String[] args) {
        SpringApplication.run(AnalyticsServiceApplication.class, args);
    }
}
