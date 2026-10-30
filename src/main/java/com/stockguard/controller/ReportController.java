package com.stockguard.controller;

import com.stockguard.dto.InventoryDtos.ProductDto;
import com.stockguard.dto.ReportDtos.*;
import com.stockguard.security.AuthUser;
import com.stockguard.service.ProductService;
import com.stockguard.service.ReportService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api")
public class ReportController {

    private final ReportService reportService;
    private final ProductService productService;

    public ReportController(ReportService reportService, ProductService productService) {
        this.reportService = reportService;
        this.productService = productService;
    }

    @GetMapping("/dashboard")
    public Dashboard dashboard(@AuthenticationPrincipal AuthUser user) {
        return reportService.dashboard(user.id());
    }

    @GetMapping("/reports/sales")
    public SalesReport sales(@AuthenticationPrincipal AuthUser user,
                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                             @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDate end = to == null ? LocalDate.now() : to;
        LocalDate start = from == null ? end.minusDays(29) : from;
        return reportService.salesReport(user.id(), start, end);
    }

    @GetMapping("/reports/monthly")
    public List<MonthlySales> monthly(@AuthenticationPrincipal AuthUser user,
                                      @RequestParam(required = false) Integer year) {
        return reportService.monthly(user.id(), year == null ? LocalDate.now().getYear() : year);
    }

    @GetMapping("/reports/top-products")
    public List<TopProduct> topProducts(@AuthenticationPrincipal AuthUser user,
                                        @RequestParam(defaultValue = "7") int days,
                                        @RequestParam(defaultValue = "10") int limit) {
        return reportService.topProducts(user.id(), Math.min(Math.max(days, 1), 366), Math.min(Math.max(limit, 1), 50));
    }

    @GetMapping("/reports/stock")
    public List<ProductDto> stock(@AuthenticationPrincipal AuthUser user) {
        return productService.list(user.id());
    }

    @GetMapping("/reports/reorder")
    public List<ReorderSuggestion> reorder(@AuthenticationPrincipal AuthUser user) {
        return reportService.reorderSuggestions(user.id());
    }

    @GetMapping("/reports/waste")
    public WasteSummary waste(@AuthenticationPrincipal AuthUser user) {
        return reportService.waste(user.id());
    }
}
