package com.franciscobalonero.iotplatform.device;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * Main application class for the Device Service.
 * This service is responsible for managing device registry and metadata.
 *
 * @author Francisco Balonero Olivera
 */
@SpringBootApplication(scanBasePackages = "com.franciscobalonero.iotplatform")
@EnableDiscoveryClient
public class DeviceServiceApplication {

    /**
     * Entry point for the Device Service application.
     *
     * @param args Command-line arguments.
     */
    public static void main(String[] args) {
        SpringApplication.run(DeviceServiceApplication.class, args);
    }
}
