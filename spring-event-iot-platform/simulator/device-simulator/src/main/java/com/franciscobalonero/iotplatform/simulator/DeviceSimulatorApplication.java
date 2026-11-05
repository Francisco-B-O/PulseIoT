package com.franciscobalonero.iotplatform.simulator;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Main application class for the Device Simulator.
 * Periodically generates synthetic telemetry data to simulate active IoT devices.
 *
 * @author Francisco Balonero Olivera
 */
@SpringBootApplication
@EnableScheduling
public class DeviceSimulatorApplication {

    /**
     * Entry point for the Device Simulator application.
     *
     * @param args Command-line arguments.
     */
    public static void main(String[] args) {
        SpringApplication.run(DeviceSimulatorApplication.class, args);
    }
}
