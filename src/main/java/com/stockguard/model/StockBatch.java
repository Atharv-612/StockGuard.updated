package com.stockguard.model;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** A delivery of a product: batch number, quantity left and expiry date. */
@Entity
@Table(name = "stock_batches", indexes = @Index(name = "idx_batch_product", columnList = "product_id"))
public class StockBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(nullable = false, length = 60)
    private String batchNumber;

    /** Units still on the shelf. */
    @Column(nullable = false)
    private int quantity;

    /** Units received. */
    @Column(nullable = false)
    private int initialQuantity;

    /** Null for non-perishable goods. */
    private LocalDate expiryDate;

    private LocalDate purchaseDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BatchStatus status = BatchStatus.ACTIVE;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public boolean isExpired(LocalDate today) {
        return expiryDate != null && expiryDate.isBefore(today);
    }

    public Long getId() { return id; }
    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }
    public String getBatchNumber() { return batchNumber; }
    public void setBatchNumber(String batchNumber) { this.batchNumber = batchNumber; }
    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }
    public int getInitialQuantity() { return initialQuantity; }
    public void setInitialQuantity(int initialQuantity) { this.initialQuantity = initialQuantity; }
    public LocalDate getExpiryDate() { return expiryDate; }
    public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }
    public LocalDate getPurchaseDate() { return purchaseDate; }
    public void setPurchaseDate(LocalDate purchaseDate) { this.purchaseDate = purchaseDate; }
    public BatchStatus getStatus() { return status; }
    public void setStatus(BatchStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
