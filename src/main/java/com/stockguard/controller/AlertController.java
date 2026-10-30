package com.stockguard.controller;

import com.stockguard.dto.ReportDtos.*;
import com.stockguard.security.AuthUser;
import com.stockguard.service.AlertService;
import com.stockguard.service.RealtimeService;
import com.stockguard.service.ReportService;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

@RestController
@RequestMapping("/api")
public class AlertController {

    private final AlertService alertService;
    private final ReportService reportService;
    private final RealtimeService realtimeService;

    public AlertController(AlertService alertService, ReportService reportService, RealtimeService realtimeService) {
        this.alertService = alertService;
        this.reportService = reportService;
        this.realtimeService = realtimeService;
    }

    /** Current expiring / expired / low-stock items. */
    @GetMapping("/alerts")
    public AlertSummary current(@AuthenticationPrincipal AuthUser user) {
        return reportService.alertSummary(user.id());
    }

    @GetMapping("/alerts/status")
    public AlertStatus status(@AuthenticationPrincipal AuthUser user) {
        return alertService.status(user.id());
    }

    @GetMapping("/alerts/history")
    public List<AlertLogDto> history(@AuthenticationPrincipal AuthUser user) {
        return alertService.history(user.id());
    }

    @PostMapping("/alerts/send")
    public SendResult sendNow(@AuthenticationPrincipal AuthUser user) {
        return alertService.sendNow(user.id());
    }

    /** Server-Sent Events stream for real-time updates. */
    @GetMapping(path = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events(@AuthenticationPrincipal AuthUser user) {
        return realtimeService.subscribe(user.id());
    }
}
