package com.stockguard.service;

import com.stockguard.dto.InventoryDtos.*;
import com.stockguard.dto.ReportDtos.*;
import com.stockguard.exception.ApiException;
import com.stockguard.model.BatchStatus;
import com.stockguard.model.Sale;
import com.stockguard.model.StockBatch;
import com.stockguard.model.User;
import com.stockguard.repository.SaleRepository;
import com.stockguard.repository.StockBatchRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/** Sales history, top products, reorder advice, waste and the dashboard. */
@Service
public class ReportService {

    private final SaleRepository sales;
    private final StockBatchRepository batches;
    private final ProductService productService;
    private final UserService userService;
    private final InventoryMapper mapper;

    public ReportService(SaleRepository sales, StockBatchRepository batches, ProductService productService,
                         UserService userService, InventoryMapper mapper) {
        this.sales = sales;
        this.batches = batches;
        this.productService = productService;
        this.userService = userService;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public SalesReport salesReport(Long userId, LocalDate from, LocalDate to) {
        if (to.isBefore(from)) throw ApiException.badRequest("'To' date must be after 'From' date");
        if (from.plusYears(2).isBefore(to)) throw ApiException.badRequest("Please choose a range of at most 2 years");
        List<Sale> list = salesBetween(userId, from, to);
        return new SalesReport(from, to, sum(list), list.stream().mapToInt(Sale::getQuantity).sum(),
                (int) list.stream().map(Sale::getBillNumber).distinct().count(),
                daily(list, from, to), mapper.toSaleDtos(list));
    }

    @Transactional(readOnly = true)
    public List<MonthlySales> monthly(Long userId, int year) {
        List<Sale> list = salesBetween(userId, LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31));
        Map<Integer, List<Sale>> byMonth = list.stream().collect(Collectors.groupingBy(s -> s.getSoldAt().getMonthValue()));
        List<MonthlySales> result = new ArrayList<>();
        for (int m = 1; m <= 12; m++) {
            List<Sale> ms = byMonth.getOrDefault(m, List.of());
            result.add(new MonthlySales(year, m, sum(ms), ms.stream().mapToInt(Sale::getQuantity).sum()));
        }
        return result;
    }

    /** Best sellers by quantity over the last {@code days} days (objective: spot top products). */
    @Transactional(readOnly = true)
    public List<TopProduct> topProducts(Long userId, int days, int limit) {
        LocalDate to = LocalDate.now();
        List<Sale> list = salesBetween(userId, to.minusDays(Math.max(days, 1) - 1L), to);
        return list.stream()
                .collect(Collectors.groupingBy(s -> s.getProduct().getId()))
                .values().stream()
                .map(ps -> new TopProduct(ps.get(0).getProduct().getId(), ps.get(0).getProduct().getName(),
                        ps.get(0).getProduct().getCategory(),
                        ps.stream().mapToInt(Sale::getQuantity).sum(), sum(ps)))
                .sorted(Comparator.comparingInt(TopProduct::quantity).reversed()
                        .thenComparing(TopProduct::revenue, Comparator.reverseOrder()))
                .limit(limit)
                .toList();
    }

    /**
     * Objective "stop overbuying": compares stock on hand with the last 30 days of sales and suggests
     * ordering just enough for the next 14 days.
     */
    @Transactional(readOnly = true)
    public List<ReorderSuggestion> reorderSuggestions(Long userId) {
        final int lookback = 30;
        final int coverDays = 14;
        LocalDate today = LocalDate.now();
        Map<Long, Integer> soldByProduct = salesBetween(userId, today.minusDays(lookback - 1L), today).stream()
                .collect(Collectors.groupingBy(s -> s.getProduct().getId(), Collectors.summingInt(Sale::getQuantity)));

        List<ReorderSuggestion> result = new ArrayList<>();
        for (ProductDto p : productService.list(userId)) {
            int sold = soldByProduct.getOrDefault(p.id(), 0);
            double avg = sold / (double) lookback;
            int stock = p.sellableStock();
            int daysLeft = avg > 0 ? (int) Math.floor(stock / avg) : -1;
            int target = (int) Math.ceil(avg * coverDays);
            int suggested = Math.max(0, Math.max(target, p.lowStockThreshold() + 1) - stock);
            if (sold == 0) suggested = stock == 0 ? Math.max(p.lowStockThreshold(), 1) : 0;

            String advice;
            if (sold == 0 && stock > 0) advice = "No sales in 30 days - avoid reordering";
            else if (sold == 0) advice = "Out of stock with no recent sales - order a small quantity";
            else if (suggested == 0) advice = "Enough stock for ~" + daysLeft + " days - don't reorder yet";
            else if (daysLeft <= 3) advice = "Reorder now - stock runs out in ~" + daysLeft + " days";
            else advice = "Reorder soon - about " + daysLeft + " days of stock left";

            result.add(new ReorderSuggestion(p.id(), p.name(), p.category(), stock, sold,
                    Math.round(avg * 100.0) / 100.0, daysLeft, suggested, advice));
        }
        result.sort(Comparator.comparingInt(ReorderSuggestion::suggestedOrderQty).reversed()
                .thenComparing(ReorderSuggestion::name));
        return result;
    }

    @Transactional(readOnly = true)
    public WasteSummary waste(Long userId) {
        LocalDate today = LocalDate.now();
        int disposedUnits = 0;
        BigDecimal disposedValue = BigDecimal.ZERO;
        for (StockBatch b : batches.findForOwner(userId, BatchStatus.DISPOSED)) {
            disposedUnits += b.getQuantity();
            disposedValue = disposedValue.add(b.getProduct().getPrice().multiply(BigDecimal.valueOf(b.getQuantity())));
        }
        int expiredUnits = 0;
        BigDecimal expiredValue = BigDecimal.ZERO;
        for (StockBatch b : batches.findForOwner(userId, BatchStatus.ACTIVE)) {
            if (b.isExpired(today) && b.getQuantity() > 0) {
                expiredUnits += b.getQuantity();
                expiredValue = expiredValue.add(b.getProduct().getPrice().multiply(BigDecimal.valueOf(b.getQuantity())));
            }
        }
        return new WasteSummary(disposedUnits, disposedValue, expiredUnits, expiredValue);
    }

    /** What needs the owner's attention right now (shown in-app and in alert logs). */
    @Transactional(readOnly = true)
    public AlertSummary alertSummary(Long userId) {
        User user = userService.getUser(userId);
        LocalDate today = LocalDate.now();
        List<BatchDto> active = batches.findForOwner(userId, BatchStatus.ACTIVE).stream()
                .filter(b -> b.getQuantity() > 0)
                .map(b -> mapper.toBatchDto(b, today, user.getExpiryAlertDays()))
                .toList();
        List<ProductDto> products = productService.list(userId);
        return new AlertSummary(user.getExpiryAlertDays(),
                active.stream().filter(b -> b.expiryStatus() == ExpiryStatus.EXPIRING_SOON).toList(),
                active.stream().filter(b -> b.expiryStatus() == ExpiryStatus.EXPIRED).toList(),
                products.stream().filter(p -> p.stockStatus() == StockStatus.LOW_STOCK).toList(),
                products.stream().filter(p -> p.stockStatus() == StockStatus.OUT_OF_STOCK).toList());
    }

    @Transactional(readOnly = true)
    public Dashboard dashboard(Long userId) {
        User user = userService.getUser(userId);
        LocalDate today = LocalDate.now();
        List<ProductDto> products = productService.list(userId);
        AlertSummary alerts = alertSummary(userId);

        List<Sale> monthSales = salesBetween(userId, today.withDayOfMonth(1), today);
        List<Sale> weekSales = salesBetween(userId, today.minusDays(6), today);
        List<Sale> todaySales = weekSales.stream().filter(s -> s.getSoldAt().toLocalDate().equals(today)).toList();

        return new Dashboard(user.getShopName(), products.size(),
                products.stream().mapToInt(ProductDto::sellableStock).sum(),
                products.stream().map(ProductDto::stockValue).reduce(BigDecimal.ZERO, BigDecimal::add),
                sum(todaySales), todaySales.stream().mapToInt(Sale::getQuantity).sum(), sum(monthSales),
                alerts.expiringSoon().size(), alerts.expired().size(),
                alerts.lowStock().size(), alerts.outOfStock().size(),
                daily(weekSales, today.minusDays(6), today),
                topProducts(userId, 7, 5),
                mapper.toSaleDtos(weekSales.stream().limit(8).toList()),
                alerts);
    }

    private List<Sale> salesBetween(Long userId, LocalDate from, LocalDate to) {
        LocalDateTime start = from.atStartOfDay();
        LocalDateTime end = to.plusDays(1).atStartOfDay();
        return sales.findForOwnerBetween(userId, start, end);
    }

    private static List<DailySales> daily(List<Sale> list, LocalDate from, LocalDate to) {
        Map<LocalDate, List<Sale>> byDay = list.stream().collect(Collectors.groupingBy(s -> s.getSoldAt().toLocalDate()));
        List<DailySales> result = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            List<Sale> ds = byDay.getOrDefault(d, List.of());
            result.add(new DailySales(d, sum(ds), ds.stream().mapToInt(Sale::getQuantity).sum(),
                    (int) ds.stream().map(Sale::getBillNumber).distinct().count()));
        }
        return result;
    }

    private static BigDecimal sum(List<Sale> list) {
        return list.stream().map(Sale::getTotalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
