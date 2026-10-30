package com.stockguard.repository;

import com.stockguard.model.BatchStatus;
import com.stockguard.model.StockBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface StockBatchRepository extends JpaRepository<StockBatch, Long> {

    /** All batches of a shop's active products, with the product fetched to avoid N+1 queries. */
    @Query("""
            select b from StockBatch b join fetch b.product p
            where p.owner.id = :ownerId and p.active = true and b.status = :status
            order by b.expiryDate asc nulls last, b.id asc
            """)
    List<StockBatch> findForOwner(@Param("ownerId") Long ownerId, @Param("status") BatchStatus status);

    @Query("""
            select b from StockBatch b join fetch b.product p
            where p.owner.id = :ownerId and p.active = true
            order by b.expiryDate asc nulls last, b.id asc
            """)
    List<StockBatch> findAllForOwner(@Param("ownerId") Long ownerId);

    /** Batches of one product in FEFO order (first expiry, first out). */
    @Query("""
            select b from StockBatch b
            where b.product.id = :productId and b.status = com.stockguard.model.BatchStatus.ACTIVE and b.quantity > 0
            order by b.expiryDate asc nulls last, b.id asc
            """)
    List<StockBatch> findSellableCandidates(@Param("productId") Long productId);

    @Query("select b from StockBatch b join fetch b.product p where b.id = :id and p.owner.id = :ownerId and p.active = true")
    Optional<StockBatch> findByIdForOwner(@Param("id") Long id, @Param("ownerId") Long ownerId);
}
