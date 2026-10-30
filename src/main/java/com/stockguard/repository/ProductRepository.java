package com.stockguard.repository;

import com.stockguard.model.Product;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long> {

    List<Product> findByOwnerIdAndActiveTrueOrderByNameAsc(Long ownerId);

    Optional<Product> findByIdAndOwnerIdAndActiveTrue(Long id, Long ownerId);

    boolean existsByOwnerIdAndActiveTrueAndNameIgnoreCase(Long ownerId, String name);

    /** Row lock while a sale deducts stock, so two counters can't sell the same last unit. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Product p where p.id = :id and p.owner.id = :ownerId and p.active = true")
    Optional<Product> findForUpdate(@Param("id") Long id, @Param("ownerId") Long ownerId);
}
