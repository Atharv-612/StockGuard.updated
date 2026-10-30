-- StockGuard - MySQL schema (reference).
-- The application creates/updates these tables automatically on startup
-- (spring.jpa.hibernate.ddl-auto=update); this file documents the design and
-- can be used to create the database manually.

CREATE DATABASE IF NOT EXISTS stockguard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE stockguard;

-- Shop owners (login / register)
CREATE TABLE IF NOT EXISTS users (
    id                      BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_name              VARCHAR(100) NOT NULL,
    shop_name               VARCHAR(150) NOT NULL,
    email                   VARCHAR(150) NOT NULL UNIQUE,
    phone_number            VARCHAR(20),
    password                VARCHAR(255) NOT NULL,          -- BCrypt hash
    expiry_alert_days       INT          NOT NULL DEFAULT 7,
    alerts_enabled          BIT          NOT NULL DEFAULT 1,
    created_at              DATETIME(6)  NOT NULL
);

-- Product registry: names, categories and prices
CREATE TABLE IF NOT EXISTS products (
    id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_id            BIGINT        NOT NULL,
    name                VARCHAR(150)  NOT NULL,
    category            VARCHAR(80)   NOT NULL,
    price               DECIMAL(10,2) NOT NULL,
    unit                VARCHAR(20)   NOT NULL DEFAULT 'pcs',
    sku                 VARCHAR(60),
    low_stock_threshold INT           NOT NULL DEFAULT 5,
    active              BIT           NOT NULL DEFAULT 1,   -- soft delete keeps sales history valid
    created_at          DATETIME(6)   NOT NULL,
    CONSTRAINT fk_product_owner FOREIGN KEY (owner_id) REFERENCES users (id),
    INDEX idx_product_owner (owner_id)
);

-- Expiry tracking: every delivery is a batch with its own batch number and expiry date.
-- Current stock of a product = SUM(quantity) of its ACTIVE batches.
CREATE TABLE IF NOT EXISTS stock_batches (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id       BIGINT      NOT NULL,
    batch_number     VARCHAR(60) NOT NULL,
    quantity         INT         NOT NULL,                  -- units left
    initial_quantity INT         NOT NULL,                  -- units received
    expiry_date      DATE,                                  -- NULL = non-perishable
    purchase_date    DATE,
    status           VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | DISPOSED
    created_at       DATETIME(6) NOT NULL,
    CONSTRAINT fk_batch_product FOREIGN KEY (product_id) REFERENCES products (id),
    INDEX idx_batch_product (product_id)
);

-- Sales history (digital sales register). One row per product per bill.
CREATE TABLE IF NOT EXISTS sales (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_id     BIGINT        NOT NULL,
    product_id   BIGINT        NOT NULL,
    bill_number  VARCHAR(40)   NOT NULL,
    quantity     INT           NOT NULL,
    unit_price   DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    sold_at      DATETIME(6)   NOT NULL,
    CONSTRAINT fk_sale_owner FOREIGN KEY (owner_id) REFERENCES users (id),
    CONSTRAINT fk_sale_product FOREIGN KEY (product_id) REFERENCES products (id),
    INDEX idx_sale_owner_date (owner_id, sold_at)
);

-- System alert history
CREATE TABLE IF NOT EXISTS alert_logs (
    id           BIGINT AUTO_INCREMENT PRIMARY KEY,
    owner_id     BIGINT      NOT NULL,
    trigger_type VARCHAR(20) NOT NULL,  -- SCHEDULED | MANUAL | LOW_STOCK
    status       VARCHAR(20) NOT NULL,  -- SENT | FAILED | NOT_CONFIGURED | NO_NUMBER | LOGGED
    message      TEXT        NOT NULL,
    detail       VARCHAR(500),
    created_at   DATETIME(6) NOT NULL,
    CONSTRAINT fk_alert_owner FOREIGN KEY (owner_id) REFERENCES users (id),
    INDEX idx_alert_owner (owner_id)
);
