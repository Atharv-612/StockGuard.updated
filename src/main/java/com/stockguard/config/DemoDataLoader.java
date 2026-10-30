package com.stockguard.config;

import com.stockguard.model.Product;
import com.stockguard.model.Sale;
import com.stockguard.model.StockBatch;
import com.stockguard.model.User;
import com.stockguard.repository.ProductRepository;
import com.stockguard.repository.SaleRepository;
import com.stockguard.repository.StockBatchRepository;
import com.stockguard.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;

/**
 * Sample shop for demos (enabled by stockguard.demo-data=true, e.g. the "demo" profile).
 * Login: demo@stockguard.com / demo123
 */
@Component
@ConditionalOnProperty(name = "stockguard.demo-data", havingValue = "true")
public class DemoDataLoader implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataLoader.class);
    public static final String DEMO_EMAIL = "demo@stockguard.com";

    private record Seed(String name, String category, String price, String unit, int threshold,
                        int qty, Integer expiryInDays, int dailySales) {}

    private final UserRepository users;
    private final ProductRepository products;
    private final StockBatchRepository batches;
    private final SaleRepository sales;
    private final PasswordEncoder encoder;

    public DemoDataLoader(UserRepository users, ProductRepository products, StockBatchRepository batches,
                          SaleRepository sales, PasswordEncoder encoder) {
        this.users = users;
        this.products = products;
        this.batches = batches;
        this.sales = sales;
        this.encoder = encoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (users.existsByEmailIgnoreCase(DEMO_EMAIL)) return;

        User u = new User();
        u.setOwnerName("Demo Owner");
        u.setShopName("Sai Kirana Stores");
        u.setEmail(DEMO_EMAIL);
        u.setPhoneNumber("919876543210");
        u.setPassword(encoder.encode("demo123"));
        users.save(u);

        List<Seed> seeds = List.of(
                new Seed("Amul Milk 500ml", "Dairy", "28", "pcs", 10, 24, 2, 6),
                new Seed("Fresh Curd 400g", "Dairy", "35", "pcs", 5, 8, -1, 2),
                new Seed("Paneer 200g", "Dairy", "90", "pcs", 4, 3, 5, 1),
                new Seed("Brown Bread", "Bakery", "45", "pcs", 5, 12, 3, 3),
                new Seed("Parle-G Biscuits", "Snacks", "10", "pcs", 20, 120, 120, 8),
                new Seed("Lays Chips 52g", "Snacks", "20", "pcs", 10, 15, 6, 4),
                new Seed("Basmati Rice 5kg", "Grocery", "520", "bag", 3, 14, 300, 1),
                new Seed("Sugar 1kg", "Grocery", "48", "kg", 5, 4, null, 2),
                new Seed("Sunflower Oil 1L", "Grocery", "155", "bottle", 4, 18, 200, 1),
                new Seed("Toor Dal 1kg", "Grocery", "160", "kg", 4, 0, 150, 1),
                new Seed("Colgate Toothpaste", "Personal Care", "95", "pcs", 3, 22, 400, 1),
                new Seed("Coca-Cola 750ml", "Beverages", "40", "bottle", 6, 30, 45, 3));

        Random random = new Random(42);
        LocalDate today = LocalDate.now();
        int bill = 1;
        for (Seed s : seeds) {
            Product p = new Product();
            p.setOwner(u);
            p.setName(s.name());
            p.setCategory(s.category());
            p.setPrice(new BigDecimal(s.price()));
            p.setUnit(s.unit());
            p.setLowStockThreshold(s.threshold());
            products.save(p);

            StockBatch b = new StockBatch();
            b.setProduct(p);
            b.setBatchNumber("B" + (1000 + p.getId()));
            b.setQuantity(s.qty());
            b.setInitialQuantity(s.qty() + s.dailySales() * 20);
            b.setExpiryDate(s.expiryInDays() == null ? null : today.plusDays(s.expiryInDays()));
            b.setPurchaseDate(today.minusDays(20));
            batches.save(b);

            // 30 days of sales history for reports and reorder suggestions.
            for (int d = 29; d >= 0; d--) {
                int qty = Math.max(0, s.dailySales() + random.nextInt(3) - 1);
                if (qty == 0) continue;
                Sale sale = new Sale();
                sale.setOwner(u);
                sale.setProduct(p);
                sale.setBillNumber("DEMO-" + (bill++));
                sale.setQuantity(qty);
                sale.setUnitPrice(p.getPrice());
                sale.setTotalAmount(p.getPrice().multiply(BigDecimal.valueOf(qty)));
                sale.setSoldAt(LocalDateTime.of(today.minusDays(d), java.time.LocalTime.of(9 + random.nextInt(11), random.nextInt(60))));
                if (sale.getSoldAt().isAfter(LocalDateTime.now())) sale.setSoldAt(LocalDateTime.now().minusMinutes(5));
                sales.save(sale);
            }
        }
        log.info("Demo shop created - login with {} / demo123", DEMO_EMAIL);
    }
}
