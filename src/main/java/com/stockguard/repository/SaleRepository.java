package com.stockguard.repository;

import com.stockguard.model.Sale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface SaleRepository extends JpaRepository<Sale, Long> {

    @Query("""
            select s from Sale s join fetch s.product
            where s.owner.id = :ownerId and s.soldAt >= :from and s.soldAt < :to
            order by s.soldAt desc, s.id desc
            """)
    List<Sale> findForOwnerBetween(@Param("ownerId") Long ownerId,
                                   @Param("from") LocalDateTime from,
                                   @Param("to") LocalDateTime to);
}
