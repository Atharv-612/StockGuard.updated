package com.stockguard.service;

import java.util.List;

/** Application events published by services; delivered after the transaction commits. */
public final class InventoryEvents {

    private InventoryEvents() {}

    /** Something changed for this shop - connected browsers should refresh. */
    public record InventoryChanged(Long ownerId, String what) {}

    /** A sale pushed these products to/below their low-stock level. */
    public record LowStockReached(Long ownerId, List<String> lines) {}
}
