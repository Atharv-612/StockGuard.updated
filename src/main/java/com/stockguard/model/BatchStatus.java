package com.stockguard.model;

public enum BatchStatus {
    /** On the shelf (sellable unless expired). */
    ACTIVE,
    /** Expired or damaged stock thrown away - counted as waste. */
    DISPOSED
}
