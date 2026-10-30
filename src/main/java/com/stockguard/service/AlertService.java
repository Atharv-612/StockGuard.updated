package com.stockguard.service;

import com.stockguard.config.AppProperties;
import com.stockguard.dto.InventoryDtos.BatchDto;
import com.stockguard.dto.InventoryDtos.ProductDto;
import com.stockguard.dto.ReportDtos.*;
import com.stockguard.model.AlertLog;
import com.stockguard.model.User;
import com.stockguard.repository.AlertLogRepository;
import com.stockguard.repository.UserRepository;
import com.stockguard.service.InventoryEvents.InventoryChanged;
import com.stockguard.service.InventoryEvents.LowStockReached;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

/** Expiry and low-stock alerts: a daily digest, on demand, and instantly when a sale hits low stock. */
@Service
public class AlertService {

    private static final Logger log = LoggerFactory.getLogger(AlertService.class);
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd MMM yyyy");
    private static final int MAX_LINES_PER_SECTION = 10;

    private final ReportService reportService;
    private final UserService userService;
    private final UserRepository users;
    private final AlertLogRepository logs;
    private final AppProperties props;
    private final ApplicationEventPublisher events;

    public AlertService(ReportService reportService, UserService userService, UserRepository users,
                        AlertLogRepository logs, AppProperties props,
                        ApplicationEventPublisher events) {
        this.reportService = reportService;
        this.userService = userService;
        this.users = users;
        this.logs = logs;
        this.props = props;
        this.events = events;
    }

    /** Daily digest, by default every morning at 9 (stockguard.alerts.cron). */
    @Scheduled(cron = "${stockguard.alerts.cron}", zone = "${stockguard.alerts.zone}")
    public void sendDailyDigests() {
        List<User> owners = users.findByAlertsEnabledTrue();
        log.info("Running daily expiry/low-stock alerts for {} shop(s)", owners.size());
        for (User owner : owners) {
            try {
                AlertSummary summary = reportService.alertSummary(owner.getId());
                if (summary.total() > 0) {
                    deliver(owner, AlertLog.Trigger.SCHEDULED, buildDigest(owner, summary));
                }
            } catch (Exception e) {
                log.error("Daily alert failed for user {}", owner.getId(), e);
            }
        }
    }

    /** "Trigger alert digest now" action. */
    public SendResult sendNow(Long userId) {
        User owner = userService.getUser(userId);
        AlertSummary summary = reportService.alertSummary(userId);
        String message = summary.total() == 0
                ? header(owner) + "\nAll good! No expiring, expired or low-stock items today."
                : buildDigest(owner, summary);
        AlertLog entry = deliver(owner, AlertLog.Trigger.MANUAL, message);
        return new SendResult(true, entry.getStatus().name(),
                entry.getDetail(), message);
    }

    /** Instant alert notification when a sale pushes products to their low-stock level. */
    @Async
    @TransactionalEventListener(fallbackExecution = true)
    public void onLowStock(LowStockReached event) {
        User owner = userService.getUser(event.ownerId());
        if (!owner.isAlertsEnabled()) return;
        StringBuilder sb = new StringBuilder(header(owner)).append("\nLow stock - just sold:\n");
        event.lines().forEach(l -> sb.append("- ").append(l).append('\n'));
        sb.append("\nRestock soon to avoid missed sales.");
        deliver(owner, AlertLog.Trigger.LOW_STOCK, sb.toString().trim());
    }

    public AlertStatus status(Long userId) {
        User owner = userService.getUser(userId);
        return new AlertStatus(owner.isAlertsEnabled(), owner.getPhoneNumber(), props.alerts().cron());
    }

    public List<AlertLogDto> history(Long userId) {
        return logs.findTop50ByOwnerIdOrderByCreatedAtDesc(userId).stream()
                .map(l -> new AlertLogDto(l.getId(), l.getTriggerType().name(), l.getStatus().name(),
                        l.getMessage(), l.getDetail(), l.getCreatedAt()))
                .toList();
    }

    private AlertLog deliver(User owner, AlertLog.Trigger trigger, String message) {
        AlertLog entry = new AlertLog();
        entry.setOwner(owner);
        entry.setTriggerType(trigger);
        entry.setMessage(message);
        entry.setStatus(AlertLog.Status.SENT);
        entry.setDetail("Recorded in system alert log");
        logs.save(entry);
        events.publishEvent(new InventoryChanged(owner.getId(), "alert"));
        return entry;
    }

    private static String header(User owner) {
        return "StockGuard Alert - " + owner.getShopName() + "\n" + LocalDate.now().format(DATE) + "\n";
    }

    String buildDigest(User owner, AlertSummary s) {
        StringBuilder sb = new StringBuilder(header(owner));
        if (!s.expired().isEmpty()) {
            sb.append("\n*EXPIRED - remove from shelf (").append(s.expired().size()).append(")*\n");
            appendBatches(sb, s.expired(), true);
        }
        if (!s.expiringSoon().isEmpty()) {
            sb.append("\n*Expiring within ").append(s.expiryAlertDays()).append(" days (")
                    .append(s.expiringSoon().size()).append(")*\n");
            appendBatches(sb, s.expiringSoon(), false);
        }
        if (!s.outOfStock().isEmpty()) {
            sb.append("\n*Out of stock (").append(s.outOfStock().size()).append(")*\n");
            appendProducts(sb, s.outOfStock());
        }
        if (!s.lowStock().isEmpty()) {
            sb.append("\n*Low stock (").append(s.lowStock().size()).append(")*\n");
            appendProducts(sb, s.lowStock());
        }
        sb.append("\nLess Waste, More Profit!");
        return sb.toString();
    }

    private static void appendBatches(StringBuilder sb, List<BatchDto> list, boolean expired) {
        list.stream().limit(MAX_LINES_PER_SECTION).forEach(b -> {
            long days = b.daysToExpiry() == null ? 0 : b.daysToExpiry();
            String when = expired ? "expired " + (-days) + " day(s) ago"
                    : days == 0 ? "expires TODAY" : "in " + days + " day(s)";
            sb.append("- ").append(b.productName()).append(" (batch ").append(b.batchNumber()).append("): ")
                    .append(b.quantity()).append(' ').append(b.unit()).append(", ").append(when).append('\n');
        });
        if (list.size() > MAX_LINES_PER_SECTION) {
            sb.append("...and ").append(list.size() - MAX_LINES_PER_SECTION).append(" more\n");
        }
    }

    private static void appendProducts(StringBuilder sb, List<ProductDto> list) {
        list.stream().limit(MAX_LINES_PER_SECTION).forEach(p ->
                sb.append("- ").append(p.name()).append(": ").append(p.sellableStock()).append(' ').append(p.unit())
                        .append(" left (min ").append(p.lowStockThreshold()).append(")\n"));
        if (list.size() > MAX_LINES_PER_SECTION) {
            sb.append("...and ").append(list.size() - MAX_LINES_PER_SECTION).append(" more\n");
        }
    }
}
