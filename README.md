# StreamForge
Adaptive Bitrate Video Streaming with HLS, NGINX Cache, Spring Boot, and React

StreamForge is an end-to-end video streaming system that demonstrates Adaptive Bitrate Streaming (ABR) using HLS, NGINX caching, a Spring Boot backend, and a React + hls.js frontend.  
It simulates a CDN-like architecture locally and visualizes real-time bitrate switching based on network conditions.

---

## Features

- HLS Adaptive Bitrate Streaming (240p / 360p / 720p)
- Automatic quality switching using hls.js
- Manual quality override from UI
- NGINX reverse proxy + cache (HIT / MISS)
- Spring Boot catalog & QoE APIs
- React-based video player
- QoE tracking (startup time, rebuffers, variant used)
- Real-time bitrate switch logging

---

## Architecture Overview

### System Flow

<img width="850" height="1100" alt="streamForge" src="https://github.com/user-attachments/assets/211f2162-d4a9-4a08-be2e-a9729686a0e3" />

---

### Flow Explanation

1. React UI requests video metadata from Spring Boot  
2. Spring Boot returns the HLS master playlist URL  
3. Browser loads HLS through NGINX cache layer  
4. NGINX serves content from cache or origin (HIT / MISS)  
5. hls.js automatically selects bitrate variants  
6. Player sends QoE metrics back to backend  

---

## Adaptive Bitrate Switching (Live)

Below is a snapshot of real-time variant switches chosen by hls.js during playback:

<img width="375" height="132" alt="git-stream" src="https://github.com/user-attachments/assets/d127ad3d-9e84-4850-93b0-e1f8bce58735" />

---

## FFmpeg: Generating Adaptive Bitrate HLS Streams

This command converts a single MP4 video into multiple HLS variants (240p, 360p, 720p) and generates a master playlist that enables adaptive bitrate streaming based on network throughput and buffer health.

```bash
ffmpeg -i input.mp4 \
-filter_complex "
[0:v]split=3[v1][v2][v3];
[v1]scale=426:240[v1out];
[v2]scale=640:360[v2out];
[v3]scale=1280:720[v3out]
" \
-map [v1out] -map 0:a -c:v:0 libx264 -b:v:0 400k \
-map [v2out] -map 0:a -c:v:1 libx264 -b:v:1 900k \
-map [v3out] -map 0:a -c:v:2 libx264 -b:v:2 2000k \
-f hls \
-hls_time 2 \
-hls_playlist_type vod \
-hls_flags independent_segments \
-hls_segment_type fmp4 \
-hls_fmp4_init_filename "init_%v.mp4" \
-hls_segment_filename "v%v/seg_%03d.m4s" \
-master_pl_name master.m3u8 \
-vf format=yuv420p \
v%v/index.m3u8
