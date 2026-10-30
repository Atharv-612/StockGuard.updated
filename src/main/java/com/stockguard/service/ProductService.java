package com.stockguard.service;

import com.stockguard.dto.InventoryDtos.ProductDto;
import com.stockguard.dto.InventoryDtos.ProductRequest;
import com.stockguard.exception.ApiException;
import com.stockguard.model.BatchStatus;
import com.stockguard.model.Product;
import com.stockguard.model.StockBatch;
import com.stockguard.model.User;
import com.stockguard.repository.ProductRepository;
import com.stockguard.repository.StockBatchRepository;
import com.stockguard.service.InventoryEvents.InventoryChanged;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.stream.Collectors;

@Service
public class ProductService {

    private final ProductRepository products;
    private final StockBatchRepository batches;
    private final UserService userService;
    private final InventoryMapper mapper;
    private final ApplicationEventPublisher events;

    public ProductService(ProductRepository products, StockBatchRepository batches, UserService userService,
                          InventoryMapper mapper, ApplicationEventPublisher events) {
        this.products = products;
        this.batches = batches;
        this.userService = userService;
        this.mapper = mapper;
        this.events = events;
    }

    /** All products with live stock figures. */
    @Transactional(readOnly = true)
    public List<ProductDto> list(Long userId) {
        User user = userService.getUser(userId);
        LocalDate today = LocalDate.now();
        Map<Long, List<StockBatch>> byProduct = batches.findForOwner(userId, BatchStatus.ACTIVE).stream()
                .collect(Collectors.groupingBy(b -> b.getProduct().getId()));
        return products.findByOwnerIdAndActiveTrueOrderByNameAsc(userId).stream()
                .map(p -> mapper.toProductDto(p, byProduct.getOrDefault(p.getId(), List.of()), today,
                        user.getExpiryAlertDays()))
                .toList();
    }

    @Transactional(readOnly = true)
    public ProductDto get(Long userId, Long productId) {
        return list(userId).stream().filter(p -> p.id().equals(productId)).findFirst()
                .orElseThrow(() -> ApiException.notFound("Product"));
    }

    @Transactional(readOnly = true)
    public List<String> categories(Long userId) {
        return products.findByOwnerIdAndActiveTrueOrderByNameAsc(userId).stream()
                .map(Product::getCategory)
                .collect(Collectors.toCollection(() -> new TreeSet<>(String.CASE_INSENSITIVE_ORDER)))
                .stream().toList();
    }

    @Transactional
    public ProductDto create(Long userId, ProductRequest req) {
        User user = userService.getUser(userId);
        if (products.existsByOwnerIdAndActiveTrueAndNameIgnoreCase(userId, req.name().trim())) {
            throw new ApiException(HttpStatus.CONFLICT, "A product named '" + req.name().trim() + "' already exists");
        }
        Product p = new Product();
        p.setOwner(user);
        apply(p, req);
        products.save(p);

        if (req.openingStock() != null && req.openingStock() > 0) {
            StockBatch b = new StockBatch();
            b.setProduct(p);
            String batchNo = req.openingBatchNumber();
            b.setBatchNumber(batchNo == null || batchNo.isBlank()
                    ? "OPEN-" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE)
                    : batchNo.trim());
            b.setQuantity(req.openingStock());
            b.setInitialQuantity(req.openingStock());
            b.setExpiryDate(req.openingExpiryDate());
            b.setPurchaseDate(LocalDate.now());
            batches.save(b);
        }
        events.publishEvent(new InventoryChanged(userId, "product"));
        return get(userId, p.getId());
    }

    @Transactional
    public ProductDto update(Long userId, Long productId, ProductRequest req) {
        Product p = owned(userId, productId);
        String newName = req.name().trim();
        if (!p.getName().equalsIgnoreCase(newName)
                && products.existsByOwnerIdAndActiveTrueAndNameIgnoreCase(userId, newName)) {
            throw new ApiException(HttpStatus.CONFLICT, "A product named '" + newName + "' already exists");
        }
        apply(p, req);
        events.publishEvent(new InventoryChanged(userId, "product"));
        return get(userId, productId);
    }

    @Transactional
    public void delete(Long userId, Long productId) {
        Product p = owned(userId, productId);
        p.setActive(false);
        events.publishEvent(new InventoryChanged(userId, "product"));
    }

    Product owned(Long userId, Long productId) {
        return products.findByIdAndOwnerIdAndActiveTrue(productId, userId)
                .orElseThrow(() -> ApiException.notFound("Product"));
    }

    private static void apply(Product p, ProductRequest req) {
        p.setName(req.name().trim());
        p.setCategory(req.category().trim());
        p.setPrice(req.price().setScale(2, RoundingMode.HALF_UP));
        p.setUnit(req.unit() == null || req.unit().isBlank() ? "pcs" : req.unit().trim());
        p.setSku(req.sku() == null || req.sku().isBlank() ? null : req.sku().trim());
        p.setLowStockThreshold(req.lowStockThreshold());
    }
}
