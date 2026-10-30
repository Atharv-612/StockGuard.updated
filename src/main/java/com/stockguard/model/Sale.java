package com.stockguard.model;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** One line of a sale transaction (digital replacement for the paper sales register). */
@Entity
@Table(name = "sales", indexes = @Index(name = "idx_sale_owner_date", columnList = "owner_id,soldAt"))
public class Sale {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id")
    private User owner;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id")
    private Product product;

    /** Groups the lines that were billed together. */
    @Column(nullable = false, length = 40)
    private String billNumber;

    @Column(nullable = false)
    private int quantity;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(nullable = false)
    private LocalDateTime soldAt;

    @PrePersist
    void onCreate() {
        if (soldAt == null) soldAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }
    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }
    public String getBillNumber() { return billNumber; }
    public void setBillNumber(String billNumber) { this.billNumber = billNumber; }
    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public LocalDateTime getSoldAt() { return soldAt; }
    public void setSoldAt(LocalDateTime soldAt) { this.soldAt = soldAt; }
}
