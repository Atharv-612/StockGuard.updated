package com.stockguard.controller;

import com.stockguard.dto.InventoryDtos.BatchDto;
import com.stockguard.dto.InventoryDtos.BatchRequest;
import com.stockguard.security.AuthUser;
import com.stockguard.service.BatchService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Stock batches (stock-in with batch number and expiry date). */
@RestController
@RequestMapping("/api/batches")
public class BatchController {

    private final BatchService batchService;

    public BatchController(BatchService batchService) {
        this.batchService = batchService;
    }

    /** filter = all | instock | expiring | expired | disposed */
    @GetMapping
    public List<BatchDto> list(@AuthenticationPrincipal AuthUser user,
                               @RequestParam(defaultValue = "all") String filter,
                               @RequestParam(required = false) Long productId) {
        return batchService.list(user.id(), filter, productId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BatchDto create(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody BatchRequest req) {
        return batchService.create(user.id(), req);
    }

    @PutMapping("/{id}")
    public BatchDto update(@AuthenticationPrincipal AuthUser user, @PathVariable Long id,
                           @Valid @RequestBody BatchRequest req) {
        return batchService.update(user.id(), id, req);
    }

    @PostMapping("/{id}/dispose")
    public BatchDto dispose(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        return batchService.dispose(user.id(), id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        batchService.delete(user.id(), id);
    }
}
