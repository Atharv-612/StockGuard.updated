package com.stockguard.controller;

import com.stockguard.dto.InventoryDtos.ProductDto;
import com.stockguard.dto.InventoryDtos.ProductRequest;
import com.stockguard.security.AuthUser;
import com.stockguard.service.ProductService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    public List<ProductDto> list(@AuthenticationPrincipal AuthUser user) {
        return productService.list(user.id());
    }

    @GetMapping("/categories")
    public List<String> categories(@AuthenticationPrincipal AuthUser user) {
        return productService.categories(user.id());
    }

    @GetMapping("/{id}")
    public ProductDto get(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        return productService.get(user.id(), id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductDto create(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody ProductRequest req) {
        return productService.create(user.id(), req);
    }

    @PutMapping("/{id}")
    public ProductDto update(@AuthenticationPrincipal AuthUser user, @PathVariable Long id,
                             @Valid @RequestBody ProductRequest req) {
        return productService.update(user.id(), id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        productService.delete(user.id(), id);
    }
}
