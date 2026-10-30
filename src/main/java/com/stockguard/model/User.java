package com.stockguard.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/** A shop owner account. Every product, batch and sale belongs to one user. */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String ownerName;

    @Column(nullable = false, length = 150)
    private String shopName;

    @Column(nullable = false, unique = true, length = 150)
    private String email;

    /** Shop contact phone number, e.g. 919876543210. */
    @Column(length = 20)
    private String phoneNumber;

    @Column(nullable = false)
    private String password;

    /** Batches expiring within this many days are flagged as "expiring soon". */
    @Column(nullable = false)
    private int expiryAlertDays = 7;

    @Column(nullable = false)
    private boolean alertsEnabled = true;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOwnerName() { return ownerName; }
    public void setOwnerName(String ownerName) { this.ownerName = ownerName; }
    public String getShopName() { return shopName; }
    public void setShopName(String shopName) { this.shopName = shopName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public int getExpiryAlertDays() { return expiryAlertDays; }
    public void setExpiryAlertDays(int expiryAlertDays) { this.expiryAlertDays = expiryAlertDays; }
    public boolean isAlertsEnabled() { return alertsEnabled; }
    public void setAlertsEnabled(boolean alertsEnabled) { this.alertsEnabled = alertsEnabled; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
