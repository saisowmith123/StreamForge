package com.streamforge.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedDeque;

import com.streamforge.dto.QoeEvent;

@RestController
@RequestMapping("/api/qoe")
public class QoeController {
    private final Deque<QoeEvent> events = new ConcurrentLinkedDeque<>();
    private static final int MAX_EVENTS = 5000;

    @PostMapping
    public ResponseEntity<?> ingest(@RequestBody QoeEvent event) {
        if (event.videoId == null || event.sessionId == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "INVALID_EVENT",
                    "required", List.of("videoId", "sessionId")
            ));
        }
        event.receivedAt = Instant.now().toString();

        events.addFirst(event);
        while (events.size() > MAX_EVENTS) events.removeLast();

        return ResponseEntity.ok(Map.of("status", "ok"));
    }

    @GetMapping("/latest")
    public List<QoeEvent> latest(@RequestParam(defaultValue = "20") int n) {
        n = Math.max(1, Math.min(n, 200));
        List<QoeEvent> out = new ArrayList<>(n);
        Iterator<QoeEvent> it = events.iterator();
        while (it.hasNext() && out.size() < n) out.add(it.next());
        return out;
    }

    @GetMapping("/summary")
    public Map<String, Object> summary() {
        long total = events.size();

        long eventsWithRebuffer = events.stream()
                .filter(e -> e.rebufferCount != null && e.rebufferCount > 0)
                .count();

        OptionalDouble avgStartup = events.stream()
                .map(e -> e.startupTimeMs)
                .filter(Objects::nonNull)
                .mapToLong(Long::longValue)
                .average();

        OptionalDouble avgWatched = events.stream()
                .map(e -> e.watchedMs)
                .filter(Objects::nonNull)
                .mapToLong(Long::longValue)
                .average();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalEvents", total);
        out.put("eventsWithRebuffer", eventsWithRebuffer);
        out.put("avgStartupTimeMs", avgStartup.isPresent() ? avgStartup.getAsDouble() : null);
        out.put("avgWatchedMs", avgWatched.isPresent() ? avgWatched.getAsDouble() : null);

        Map<String, Long> variantCounts = events.stream()
                .map(e -> e.variant)
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.groupingBy(v -> v, java.util.stream.Collectors.counting()));
        out.put("variantCounts", variantCounts);

        return out;
    }

}
