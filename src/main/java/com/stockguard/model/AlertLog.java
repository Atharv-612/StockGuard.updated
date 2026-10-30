package com.stockguard.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/** History of system alert notifications. */
@Entity
@Table(name = "alert_logs", indexes = @Index(name = "idx_alert_owner", columnList = "owner_id"))
public class AlertLog {

    public enum Trigger { SCHEDULED, MANUAL, LOW_STOCK }

    public enum Status { SENT, FAILED, NOT_CONFIGURED, NO_NUMBER }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id")
    private User owner;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Trigger triggerType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(length = 500)
    private String detail;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public User getOwner() { return owner; }
    public void setOwner(User owner) { this.owner = owner; }
    public Trigger getTriggerType() { return triggerType; }
    public void setTriggerType(Trigger triggerType) { this.triggerType = triggerType; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
