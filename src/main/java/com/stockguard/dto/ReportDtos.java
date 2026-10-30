package com.stockguard.dto;

import com.stockguard.dto.InventoryDtos.BatchDto;
import com.stockguard.dto.InventoryDtos.ProductDto;
import com.stockguard.dto.InventoryDtos.SaleDto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class ReportDtos {

    private ReportDtos() {}

    public record DailySales(LocalDate date, BigDecimal revenue, int items, int bills) {}

    public record MonthlySales(int year, int month, BigDecimal revenue, int items) {}

    public record SalesReport(LocalDate from, LocalDate to, BigDecimal totalRevenue, int totalItems, int totalBills,
                              List<DailySales> daily, List<SaleDto> sales) {}

    public record TopProduct(Long productId, String name, String category, int quantity, BigDecimal revenue) {}

    public record ReorderSuggestion(Long productId, String name, String category, int currentStock,
                                    int soldLast30Days, double avgDailySales, int daysOfStockLeft,
                                    int suggestedOrderQty, String advice) {}

    public record WasteSummary(int disposedUnits, BigDecimal disposedValue, int expiredUnitsOnShelf,
                               BigDecimal expiredValueOnShelf) {}

    public record AlertSummary(int expiryAlertDays, List<BatchDto> expiringSoon, List<BatchDto> expired,
                               List<ProductDto> lowStock, List<ProductDto> outOfStock) {
        public int total() {
            return expiringSoon.size() + expired.size() + lowStock.size() + outOfStock.size();
        }
    }

    public record Dashboard(String shopName, int totalProducts, int totalUnits, BigDecimal stockValue,
                            BigDecimal todayRevenue, int todayItems, BigDecimal monthRevenue,
                            int expiringSoonCount, int expiredCount, int lowStockCount, int outOfStockCount,
                            List<DailySales> last7Days, List<TopProduct> topProductsThisWeek,
                            List<SaleDto> recentSales, AlertSummary alerts) {}

    public record AlertLogDto(Long id, String trigger, String status, String message, String detail,
                              LocalDateTime createdAt) {}

    public record AlertStatus(boolean alertsEnabled, String phoneNumber, String scheduleCron) {}

    public record SendResult(boolean sent, String status, String detail, String message) {}
}
