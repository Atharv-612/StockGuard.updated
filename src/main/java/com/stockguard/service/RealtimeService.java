package com.stockguard.service;

import com.stockguard.service.InventoryEvents.InventoryChanged;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Real-time updates: every open browser tab keeps a Server-Sent Events stream. When stock, sales or
 * alerts change for a shop, all of that shop's tabs are told to refresh.
 */
@Service
public class RealtimeService {

    private static final long TIMEOUT_MS = Duration.ofMinutes(30).toMillis();

    private final Map<Long, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    public SseEmitter subscribe(Long userId) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        List<SseEmitter> list = emitters.computeIfAbsent(userId, k -> new CopyOnWriteArrayList<>());
        list.add(emitter);
        Runnable remove = () -> list.remove(emitter);
        emitter.onCompletion(remove);
        emitter.onTimeout(remove);
        emitter.onError(e -> remove.run());
        send(emitter, list, "connected", "ok");
        return emitter;
    }

    /** Runs after the change is committed, so a refreshing browser sees the new data. */
    @TransactionalEventListener(fallbackExecution = true)
    public void onChange(InventoryChanged event) {
        List<SseEmitter> list = emitters.get(event.ownerId());
        if (list == null) return;
        for (SseEmitter emitter : list) {
            send(emitter, list, "inventory", event.what());
        }
    }

    /** Keeps idle connections open through proxies and clears out dead ones. */
    @Scheduled(fixedRate = 25_000)
    public void heartbeat() {
        emitters.values().forEach(list -> list.forEach(e -> send(e, list, "ping", "")));
    }

    private static void send(SseEmitter emitter, List<SseEmitter> list, String name, String data) {
        try {
            emitter.send(SseEmitter.event().name(name).data(data));
        } catch (IOException | IllegalStateException e) {
            list.remove(emitter);
        }
    }
}
