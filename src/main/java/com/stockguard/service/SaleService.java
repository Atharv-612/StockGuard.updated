package com.stockguard.service;

import com.stockguard.dto.InventoryDtos.BillDto;
import com.stockguard.dto.InventoryDtos.SaleDto;
import com.stockguard.dto.InventoryDtos.SaleItem;
import com.stockguard.dto.InventoryDtos.SaleRequest;
import com.stockguard.exception.ApiException;
import com.stockguard.model.Product;
import com.stockguard.model.Sale;
import com.stockguard.model.StockBatch;
import com.stockguard.model.User;
import com.stockguard.repository.ProductRepository;
import com.stockguard.repository.SaleRepository;
import com.stockguard.repository.StockBatchRepository;
import com.stockguard.service.InventoryEvents.InventoryChanged;
import com.stockguard.service.InventoryEvents.LowStockReached;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.ThreadLocalRandom;

/** Billing: records sales and deducts stock from batches, first-expiry-first-out. */
@Service
public class SaleService {

    private static final DateTimeFormatter BILL_TS = DateTimeFormatter.ofPattern("yyMMddHHmmss");

    private final SaleRepository sales;
    private final ProductRepository products;
    private final StockBatchRepository batches;
    private final UserService userService;
    private final InventoryMapper mapper;
    private final ApplicationEventPublisher events;

    public SaleService(SaleRepository sales, ProductRepository products, StockBatchRepository batches,
                       UserService userService, InventoryMapper mapper, ApplicationEventPublisher events) {
        this.sales = sales;
        this.products = products;
        this.batches = batches;
        this.userService = userService;
        this.mapper = mapper;
        this.events = events;
    }

    @Transactional
    public BillDto createBill(Long userId, SaleRequest req) {
        User user = userService.getUser(userId);
        LocalDate today = LocalDate.now();
        LocalDateTime now = LocalDateTime.now();
        String billNumber = "BILL-" + now.format(BILL_TS) + "-" + ThreadLocalRandom.current().nextInt(100, 1000);

        // Same product added twice to the cart -> one line.
        Map<Long, Integer> qtyByProduct = new LinkedHashMap<>();
        for (SaleItem item : req.items()) {
            qtyByProduct.merge(item.productId(), item.quantity(), Integer::sum);
        }

        List<Sale> lines = new ArrayList<>();
        List<String> lowStockLines = new ArrayList<>();
        BigDecimal billTotal = BigDecimal.ZERO;

        // Lock in id order so concurrent bills can't deadlock.
        for (Long productId : new TreeSet<>(qtyByProduct.keySet())) {
            Product product = products.findForUpdate(productId, userId)
                    .orElseThrow(() -> ApiException.notFound("Product"));
            int wanted = qtyByProduct.get(productId);

            List<StockBatch> sellable = batches.findSellableCandidates(productId).stream()
                    .filter(b -> !b.isExpired(today))
                    .toList();
            int available = sellable.stream().mapToInt(StockBatch::getQuantity).sum();
            if (available < wanted) {
                throw ApiException.badRequest("Only " + available + " " + product.getUnit() + " of '"
                        + product.getName() + "' available (expired stock can't be sold)");
            }

            int remaining = wanted;
            for (StockBatch b : sellable) {
                if (remaining == 0) break;
                int take = Math.min(remaining, b.getQuantity());
                b.setQuantity(b.getQuantity() - take);
                remaining -= take;
            }

            int left = available - wanted;
            if (available > product.getLowStockThreshold() && left <= product.getLowStockThreshold()) {
                lowStockLines.add(product.getName() + " - " + left + " " + product.getUnit()
                        + " left (min " + product.getLowStockThreshold() + ")");
            }

            Sale sale = new Sale();
            sale.setOwner(user);
            sale.setProduct(product);
            sale.setBillNumber(billNumber);
            sale.setQuantity(wanted);
            sale.setUnitPrice(product.getPrice());
            sale.setTotalAmount(product.getPrice().multiply(BigDecimal.valueOf(wanted)));
            sale.setSoldAt(now);
            lines.add(sales.save(sale));
            billTotal = billTotal.add(sale.getTotalAmount());
        }

        events.publishEvent(new InventoryChanged(userId, "sale"));
        if (!lowStockLines.isEmpty()) {
            events.publishEvent(new LowStockReached(userId, lowStockLines));
        }
        return new BillDto(billNumber, now, billTotal, mapper.toSaleDtos(lines));
    }

    @Transactional(readOnly = true)
    public List<SaleDto> list(Long userId, LocalDate from, LocalDate to) {
        return mapper.toSaleDtos(sales.findForOwnerBetween(userId, from.atStartOfDay(), to.plusDays(1).atStartOfDay()));
    }
}
