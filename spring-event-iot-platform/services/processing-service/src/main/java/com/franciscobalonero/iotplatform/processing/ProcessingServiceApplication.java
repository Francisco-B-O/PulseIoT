package com.franciscobalonero.iotplatform.processing;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.retry.annotation.EnableRetry;

/**
 * Main application class for the Processing Service.
 * This service handles telemetry enrichment and business logic processing.
 *
 * @author Francisco Balonero Olivera
 */
@SpringBootApplication(scanBasePackages = "com.franciscobalonero.iotplatform")
@EnableDiscoveryClient
@EnableFeignClients
@EnableRetry
public class ProcessingServiceApplication {

    /**
     * Entry point for the Processing Service application.
     *
     * @param args Command-line arguments.
     */
    public static void main(String[] args) {
        SpringApplication.run(ProcessingServiceApplication.class, args);
    }
}
