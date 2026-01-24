package com.streamforge.service;

import com.streamforge.dto.Catalog;
import com.streamforge.dto.VideoItem;
import jakarta.annotation.PostConstruct;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class StreamForgeService {
    private final ObjectMapper objectMapper;

    private Map<String, VideoItem> videoById = new HashMap<>();
    public StreamForgeService(ObjectMapper objectMapper){
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    public void loadCatalog() {
        try (InputStream in = new ClassPathResource("stream.json").getInputStream()) {
            Catalog catalog = objectMapper.readValue(in, Catalog.class);

            Map<String, VideoItem> map = new HashMap<>();
            if (catalog.videos != null) {
                for (VideoItem v : catalog.videos) {
                    if (v.id != null) {
                        map.put(v.id, v);
                    }
                }
            }
            this.videoById = map;

        } catch (Exception e) {
            throw new IllegalStateException("Failed to load stream.json from classpath", e);
        }
    }

    public Optional<Map<String, Object>> getVideoById(String id) {
        VideoItem v = videoById.get(id);
        if (v == null) return Optional.empty();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", v.id);
        response.put("title", v.title);
        response.put("playlistUrl", v.playlistUrl);

        return Optional.of(response);
    }



}
