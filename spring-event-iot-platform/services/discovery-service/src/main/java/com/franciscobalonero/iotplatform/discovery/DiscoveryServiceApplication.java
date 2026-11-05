package com.franciscobalonero.iotplatform.discovery;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.netflix.eureka.server.EnableEurekaServer;

/**
 * Main application class for the Discovery Service.
 * Acts as a Eureka Server for service registration and discovery within the microservices architecture.
 *
 * @author Francisco Balonero Olivera
 */
@SpringBootApplication
@EnableEurekaServer
public class DiscoveryServiceApplication {

    /**
     * Entry point for the Discovery Service application.
     *
     * @param args Command-line arguments.
     */
    public static void main(String[] args) {
        SpringApplication.run(DiscoveryServiceApplication.class, args);
    }
}
