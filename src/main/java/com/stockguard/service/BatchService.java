package com.stockguard.service;

import com.stockguard.dto.InventoryDtos.BatchDto;
import com.stockguard.dto.InventoryDtos.BatchRequest;
import com.stockguard.dto.InventoryDtos.ExpiryStatus;
import com.stockguard.exception.ApiException;
import com.stockguard.model.BatchStatus;
import com.stockguard.model.Product;
import com.stockguard.model.StockBatch;
import com.stockguard.model.User;
import com.stockguard.repository.StockBatchRepository;
import com.stockguard.service.InventoryEvents.InventoryChanged;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.function.Predicate;

/** Stock-in (batches with expiry dates), edits and disposal of expired stock. */
@Service
public class BatchService {

    private final StockBatchRepository batches;
    private final ProductService productService;
    private final UserService userService;
    private final InventoryMapper mapper;
    private final ApplicationEventPublisher events;

    public BatchService(StockBatchRepository batches, ProductService productService, UserService userService,
                        InventoryMapper mapper, ApplicationEventPublisher events) {
        this.batches = batches;
        this.productService = productService;
        this.userService = userService;
        this.mapper = mapper;
        this.events = events;
    }

    /**
     * @param filter all | expiring | expired | disposed
     */
    @Transactional(readOnly = true)
    public List<BatchDto> list(Long userId, String filter, Long productId) {
        User user = userService.getUser(userId);
        LocalDate today = LocalDate.now();
        String f = filter == null ? "all" : filter.toLowerCase();

        List<StockBatch> source = "disposed".equals(f)
                ? batches.findForOwner(userId, BatchStatus.DISPOSED)
                : batches.findForOwner(userId, BatchStatus.ACTIVE);

        Predicate<BatchDto> keep = switch (f) {
            case "expiring" -> b -> b.expiryStatus() == ExpiryStatus.EXPIRING_SOON && b.quantity() > 0;
            case "expired" -> b -> b.expiryStatus() == ExpiryStatus.EXPIRED && b.quantity() > 0;
            case "instock" -> b -> b.quantity() > 0;
            default -> b -> true;
        };

        return source.stream()
                .filter(b -> productId == null || b.getProduct().getId().equals(productId))
                .map(b -> mapper.toBatchDto(b, today, user.getExpiryAlertDays()))
                .filter(keep)
                .toList();
    }

    @Transactional
    public BatchDto create(Long userId, BatchRequest req) {
        User user = userService.getUser(userId);
        Product product = productService.owned(userId, req.productId());
        if (req.quantity() <= 0) throw ApiException.badRequest("Quantity must be at least 1");
        StockBatch b = new StockBatch();
        b.setProduct(product);
        b.setInitialQuantity(req.quantity());
        apply(b, req);
        batches.save(b);
        events.publishEvent(new InventoryChanged(userId, "stock"));
        return mapper.toBatchDto(b, LocalDate.now(), user.getExpiryAlertDays());
    }

    @Transactional
    public BatchDto update(Long userId, Long batchId, BatchRequest req) {
        User user = userService.getUser(userId);
        StockBatch b = owned(userId, batchId);
        if (!b.getProduct().getId().equals(req.productId())) {
            b.setProduct(productService.owned(userId, req.productId()));
        }
        apply(b, req);
        if (b.getQuantity() > b.getInitialQuantity()) b.setInitialQuantity(b.getQuantity());
        events.publishEvent(new InventoryChanged(userId, "stock"));
        return mapper.toBatchDto(b, LocalDate.now(), user.getExpiryAlertDays());
    }

    /** Throw away an expired/damaged batch; it stops counting as stock and shows up as waste. */
    @Transactional
    public BatchDto dispose(Long userId, Long batchId) {
        User user = userService.getUser(userId);
        StockBatch b = owned(userId, batchId);
        b.setStatus(BatchStatus.DISPOSED);
        events.publishEvent(new InventoryChanged(userId, "stock"));
        return mapper.toBatchDto(b, LocalDate.now(), user.getExpiryAlertDays());
    }

    @Transactional
    public void delete(Long userId, Long batchId) {
        batches.delete(owned(userId, batchId));
        events.publishEvent(new InventoryChanged(userId, "stock"));
    }

    private StockBatch owned(Long userId, Long batchId) {
        return batches.findByIdForOwner(batchId, userId).orElseThrow(() -> ApiException.notFound("Batch"));
    }

    private static void apply(StockBatch b, BatchRequest req) {
        if (req.purchaseDate() != null && req.expiryDate() != null && req.expiryDate().isBefore(req.purchaseDate())) {
            throw ApiException.badRequest("Expiry date cannot be before the purchase date");
        }
        b.setBatchNumber(req.batchNumber().trim());
        b.setQuantity(req.quantity());
        b.setExpiryDate(req.expiryDate());
        b.setPurchaseDate(req.purchaseDate() == null ? LocalDate.now() : req.purchaseDate());
    }
}
