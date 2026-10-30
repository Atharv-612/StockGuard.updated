package com.stockguard;

import com.stockguard.dto.InventoryDtos.BillDto;
import com.stockguard.dto.InventoryDtos.ProductDto;
import com.stockguard.dto.InventoryDtos.SaleItem;
import com.stockguard.dto.InventoryDtos.SaleRequest;
import com.stockguard.exception.ApiException;
import com.stockguard.repository.UserRepository;
import com.stockguard.service.ProductService;
import com.stockguard.service.SaleService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** Runs against the in-memory demo shop. */
@SpringBootTest
@ActiveProfiles("demo")
class StockGuardApplicationTests {

    @Autowired UserRepository users;
    @Autowired ProductService productService;
    @Autowired SaleService saleService;

    private Long demoUserId() {
        return users.findByEmailIgnoreCase("demo@stockguard.com").orElseThrow().getId();
    }

    private ProductDto product(Long userId, String name) {
        return productService.list(userId).stream().filter(p -> p.name().equals(name)).findFirst().orElseThrow();
    }

    @Test
    void saleDeductsStock() {
        Long userId = demoUserId();
        ProductDto before = product(userId, "Parle-G Biscuits");

        BillDto bill = saleService.createBill(userId, new SaleRequest(List.of(new SaleItem(before.id(), 5))));

        assertEquals(0, bill.total().compareTo(before.price().multiply(java.math.BigDecimal.valueOf(5))));
        assertEquals(before.sellableStock() - 5, product(userId, "Parle-G Biscuits").sellableStock());
    }

    @Test
    void expiredStockCannotBeSold() {
        Long userId = demoUserId();
        // Demo "Fresh Curd" batch expired yesterday, so nothing is sellable.
        ProductDto curd = product(userId, "Fresh Curd 400g");
        assertEquals(0, curd.sellableStock());
        assertTrue(curd.expiredStock() > 0);
        assertThrows(ApiException.class,
                () -> saleService.createBill(userId, new SaleRequest(List.of(new SaleItem(curd.id(), 1)))));
    }
}
