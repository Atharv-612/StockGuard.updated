package com.stockguard.service;

import com.stockguard.dto.InventoryDtos.*;
import com.stockguard.model.Product;
import com.stockguard.model.Sale;
import com.stockguard.model.StockBatch;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/** Turns entities into DTOs and computes stock / expiry status. */
@Component
public class InventoryMapper {

    public static ExpiryStatus expiryStatus(LocalDate expiry, LocalDate today, int alertDays) {
        if (expiry == null) return ExpiryStatus.NO_EXPIRY;
        long days = ChronoUnit.DAYS.between(today, expiry);
        if (days < 0) return ExpiryStatus.EXPIRED;
        if (days <= alertDays) return ExpiryStatus.EXPIRING_SOON;
        return ExpiryStatus.OK;
    }

    public BatchDto toBatchDto(StockBatch b, LocalDate today, int alertDays) {
        Product p = b.getProduct();
        Long days = b.getExpiryDate() == null ? null : ChronoUnit.DAYS.between(today, b.getExpiryDate());
        return new BatchDto(b.getId(), p.getId(), p.getName(), p.getCategory(), p.getUnit(),
                b.getBatchNumber(), b.getQuantity(), b.getInitialQuantity(),
                b.getExpiryDate(), b.getPurchaseDate(), days,
                expiryStatus(b.getExpiryDate(), today, alertDays), b.getStatus().name(),
                p.getPrice().multiply(BigDecimal.valueOf(b.getQuantity())));
    }

    /**
     * @param activeBatches the product's ACTIVE batches (any quantity)
     */
    public ProductDto toProductDto(Product p, Collection<StockBatch> activeBatches, LocalDate today, int alertDays) {
        int total = 0;
        int expired = 0;
        for (StockBatch b : activeBatches) {
            total += b.getQuantity();
            if (b.isExpired(today)) expired += b.getQuantity();
        }
        int sellable = total - expired;

        LocalDate nearest = activeBatches.stream()
                .filter(b -> b.getQuantity() > 0 && !b.isExpired(today))
                .map(StockBatch::getExpiryDate)
                .filter(Objects::nonNull)
                .min(Comparator.naturalOrder())
                .orElse(null);

        ExpiryStatus expiryStatus = expired > 0
                ? ExpiryStatus.EXPIRED
                : expiryStatus(nearest, today, alertDays);

        StockStatus stockStatus = sellable <= 0 ? StockStatus.OUT_OF_STOCK
                : sellable <= p.getLowStockThreshold() ? StockStatus.LOW_STOCK
                : StockStatus.IN_STOCK;

        Long daysToNearest = nearest == null ? null : ChronoUnit.DAYS.between(today, nearest);

        return new ProductDto(p.getId(), p.getName(), p.getCategory(), p.getPrice(), p.getUnit(), p.getSku(),
                p.getLowStockThreshold(), total, sellable, expired, nearest, daysToNearest,
                stockStatus, expiryStatus, p.getPrice().multiply(BigDecimal.valueOf(sellable)));
    }

    public SaleDto toSaleDto(Sale s) {
        Product p = s.getProduct();
        return new SaleDto(s.getId(), s.getBillNumber(), p.getId(), p.getName(), p.getCategory(),
                s.getQuantity(), s.getUnitPrice(), s.getTotalAmount(), s.getSoldAt());
    }

    public List<SaleDto> toSaleDtos(List<Sale> sales) {
        return sales.stream().map(this::toSaleDto).toList();
    }
}
