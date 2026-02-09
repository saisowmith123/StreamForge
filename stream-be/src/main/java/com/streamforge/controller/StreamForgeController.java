package com.streamforge.controller;

import com.streamforge.service.StreamForgeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class StreamForgeController {
    private final StreamForgeService streamForgeService;
    private final String VIDEO_NOT_FOUND = "VIDEO_NOT_FOUND";

    public StreamForgeController(StreamForgeService streamForgeService){
        this.streamForgeService = streamForgeService;
    }

    @GetMapping("/play/{id}")
    public ResponseEntity<?> play(@PathVariable String id) {
        return streamForgeService.getVideoById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(404).body(
                        Map.of("error", VIDEO_NOT_FOUND, "id", id)
                ));
    }


}
