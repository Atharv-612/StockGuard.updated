package com.stockguard.repository;

import com.stockguard.model.AlertLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AlertLogRepository extends JpaRepository<AlertLog, Long> {

    List<AlertLog> findTop50ByOwnerIdOrderByCreatedAtDesc(Long ownerId);
}
