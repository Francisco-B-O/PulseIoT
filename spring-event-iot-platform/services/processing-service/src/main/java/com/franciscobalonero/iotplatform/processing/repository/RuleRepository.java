package com.franciscobalonero.iotplatform.processing.repository;

import com.franciscobalonero.iotplatform.processing.model.Rule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Repository interface for managing Rule entities.
 *
 * @author Francisco Balonero Olivera
 */
@Repository
public interface RuleRepository extends JpaRepository<Rule, Long> {
    Optional<Rule> findByMetric(String metric);
}
