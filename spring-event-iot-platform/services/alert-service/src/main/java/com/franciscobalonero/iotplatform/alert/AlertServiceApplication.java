package com.franciscobalonero.iotplatform.alert;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * Main application class for the Alert Service.
 * This service is responsible for managing alerts generated based on processed telemetry data.
 *
 * @author Francisco Balonero Olivera
 */
@SpringBootApplication(scanBasePackages = "com.franciscobalonero.iotplatform")
@EnableDiscoveryClient
public class AlertServiceApplication {

    /**
     * Entry point for the Alert Service application.
     *
     * @param args Command-line arguments.
     */
    public static void main(String[] args) {
        SpringApplication.run(AlertServiceApplication.class, args);
    }
}
