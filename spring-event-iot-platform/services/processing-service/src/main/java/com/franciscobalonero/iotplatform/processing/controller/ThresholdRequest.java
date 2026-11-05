package com.franciscobalonero.iotplatform.processing.controller;

/**
 * Request body for updating the temperature anomaly detection threshold.
 *
 * @param threshold The new threshold value to apply.
 * @author Francisco Balonero Olivera
 */
public record ThresholdRequest(double threshold) {}
