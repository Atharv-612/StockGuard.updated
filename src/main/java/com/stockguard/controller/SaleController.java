package com.stockguard.controller;

import com.stockguard.dto.InventoryDtos.BillDto;
import com.stockguard.dto.InventoryDtos.SaleDto;
import com.stockguard.dto.InventoryDtos.SaleRequest;
import com.stockguard.exception.ApiException;
import com.stockguard.security.AuthUser;
import com.stockguard.service.SaleService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/sales")
public class SaleController {

    private final SaleService saleService;

    public SaleController(SaleService saleService) {
        this.saleService = saleService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BillDto createBill(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody SaleRequest req) {
        return saleService.createBill(user.id(), req);
    }

    @GetMapping
    public List<SaleDto> list(@AuthenticationPrincipal AuthUser user,
                              @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                              @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        LocalDate end = to == null ? LocalDate.now() : to;
        LocalDate start = from == null ? end.minusDays(6) : from;
        if (end.isBefore(start)) throw ApiException.badRequest("'To' date must be after 'From' date");
        return saleService.list(user.id(), start, end);
    }
}
