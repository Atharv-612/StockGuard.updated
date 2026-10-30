package com.stockguard.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class InventoryDtos {

    private InventoryDtos() {}

    public enum StockStatus { IN_STOCK, LOW_STOCK, OUT_OF_STOCK }

    public enum ExpiryStatus { OK, EXPIRING_SOON, EXPIRED, NO_EXPIRY }

    // ---------- Products ----------

    public record ProductRequest(
            @NotBlank(message = "Product name is required") @Size(max = 150) String name,
            @NotBlank(message = "Category is required") @Size(max = 80) String category,
            @NotNull(message = "Price is required") @DecimalMin(value = "0.0", message = "Price cannot be negative") BigDecimal price,
            @Size(max = 20) String unit,
            @Size(max = 60) String sku,
            @Min(value = 0, message = "Low stock level cannot be negative") int lowStockThreshold,
            /* Optional opening stock, created as the first batch. */
            @Min(value = 0, message = "Opening stock cannot be negative") Integer openingStock,
            LocalDate openingExpiryDate,
            @Size(max = 60) String openingBatchNumber) {}

    public record ProductDto(Long id, String name, String category, BigDecimal price, String unit, String sku,
                             int lowStockThreshold, int totalStock, int sellableStock, int expiredStock,
                             LocalDate nearestExpiry, Long daysToNearestExpiry,
                             StockStatus stockStatus, ExpiryStatus expiryStatus, BigDecimal stockValue) {}

    // ---------- Batches ----------

    public record BatchRequest(
            @NotNull(message = "Product is required") Long productId,
            @NotBlank(message = "Batch number is required") @Size(max = 60) String batchNumber,
            @NotNull(message = "Quantity is required") @Min(value = 0, message = "Quantity cannot be negative") Integer quantity,
            LocalDate expiryDate,
            LocalDate purchaseDate) {}

    public record BatchDto(Long id, Long productId, String productName, String category, String unit,
                           String batchNumber, int quantity, int initialQuantity,
                           LocalDate expiryDate, LocalDate purchaseDate, Long daysToExpiry,
                           ExpiryStatus expiryStatus, String status, BigDecimal value) {}

    // ---------- Sales ----------

    public record SaleItem(@NotNull(message = "Product is required") Long productId,
                           @NotNull @Min(value = 1, message = "Quantity must be at least 1") Integer quantity) {}

    public record SaleRequest(@NotEmpty(message = "Add at least one item") List<@Valid SaleItem> items) {}

    public record SaleDto(Long id, String billNumber, Long productId, String productName, String category,
                          int quantity, BigDecimal unitPrice, BigDecimal totalAmount, LocalDateTime soldAt) {}

    public record BillDto(String billNumber, LocalDateTime soldAt, BigDecimal total, List<SaleDto> lines) {}
}
