package com.franciscobalonero.iotplatform.notification;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * Main application class for the Notification Service.
 * This service is responsible for delivering notifications (simulated) based on system alerts.
 *
 * @author Francisco Balonero Olivera
 */
@SpringBootApplication
@EnableDiscoveryClient
public class NotificationServiceApplication {

    /**
     * Entry point for the Notification Service application.
     *
     * @param args Command-line arguments.
     */
    public static void main(String[] args) {
        SpringApplication.run(NotificationServiceApplication.class, args);
    }
}
