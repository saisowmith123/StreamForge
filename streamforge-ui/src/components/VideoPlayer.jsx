import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { createQoeTracker, createSessionId } from "../lib/qoeTracker";
import { postQoeEvent } from "../lib/qoeClient";

/**
 * VideoPlayer
 * - Fetches playlist URL from backend: /api/play/:id
 * - Plays HLS using native support (Safari) or hls.js (Chrome/Firefox)
 * - Tracks ABR level switches (0/1/2...) and shows them
 */
export default function VideoPlayer({ videoId = "1" }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const qoeRef = useRef(null);
  const qoeTimerRef = useRef(null);

  const [status, setStatus] = useState("Idle");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [qualityMode, setQualityMode] = useState("auto");
  const [availableLevels, setAvailableLevels] = useState([]);

  const [levelInfo, setLevelInfo] = useState({
    current: null,
    height: null,
    bitrate: null,
  });
  const [switches, setSwitches] = useState([]);

  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, []);

  const attachHls = async (url) => {
    const video = videoRef.current;
    if (!video) throw new Error("Video element not ready");

    console.log(
      "canPlayType(HLS):",
      video.canPlayType("application/vnd.apple.mpegurl")
    );
    console.log("Hls.isSupported():", Hls.isSupported());

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setLevelInfo({ current: null, height: null, bitrate: null });
    setSwitches([]);

    const forceHlsJs = true;

    if (!forceHlsJs && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      return;
    }

    if (!Hls.isSupported()) {
      throw new Error("HLS not supported in this browser. Try Chrome/Safari.");
    }

    const hls = new Hls();
    hlsRef.current = hls;

    hls.loadSource(url);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      const levels = (hls.levels || []).map((l, idx) => ({
        idx,
        height: l.height,
        bitrate: l.bitrate,
      }));

      setAvailableLevels(levels);
      console.log("Available levels:", levels);
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
      const idx = data.level;
      const level = hls.levels?.[idx];

      const info = {
        current: idx,
        height: level?.height ?? null,
        bitrate: level?.bitrate ?? null,
      };

      setLevelInfo(info);
      setSwitches((prev) =>
        [{ ts: new Date().toLocaleTimeString(), ...info }, ...prev].slice(0, 20)
      );

      console.log("Switched level:", info);
    });

    hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
      const idx = hls.currentLevel;
      const level = hls.levels?.[idx];
      if (idx == null || idx < 0) return;
      qoeRef.current?.setVariant(idx);

      const info = {
        current: idx,
        height: level?.height ?? null,
        bitrate: level?.bitrate ?? null,
      };

      setLevelInfo(info);

      setSwitches((prev) =>
        [{ ts: new Date().toLocaleTimeString(), ...info }, ...prev].slice(0, 20)
      );

      console.log("LEVEL_LOADED:", data, "currentLevel:", idx, "info:", info);
    });

    hls.on(Hls.Events.FRAG_CHANGED, () => {
      const idx = hls.currentLevel;
      const level = hls.levels?.[idx];
      if (idx == null || idx < 0) return;
      qoeRef.current?.setVariant(idx);

      setLevelInfo({
        current: idx,
        height: level?.height ?? null,
        bitrate: level?.bitrate ?? null,
      });
    });

    hls.on(Hls.Events.ERROR, (_, err) => {
      console.error("hls.js error:", err);
    });
  };

  const applyQuality = (mode) => {
    setQualityMode(mode);

    const hls = hlsRef.current;
    if (!hls) return;

    if (mode === "auto") {
      hls.currentLevel = -1;
      return;
    }

    const idx = Number(mode);
    if (!Number.isNaN(idx)) {
      hls.currentLevel = idx;
      hls.nextLevel = idx;
      hls.loadLevel = idx;
    }
  };

  const play = async () => {
    try {
      setStatus("Fetching playlist URL...");
      const sessionId = createSessionId();
      qoeRef.current = createQoeTracker({ sessionId, videoId });
      qoeRef.current.onPlayClicked();

      setQualityMode("auto");

      const res = await fetch(`/api/play/${videoId}`);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Backend error ${res.status}: ${txt}`);
      }

      const data = await res.json();
      const url = data.playlistUrl;
      if (!url) throw new Error("playlistUrl missing in backend response");

      setPlaylistUrl(url);
      setStatus("Attaching player...");

      await attachHls(url);

      // attempt autoplay
      const video = videoRef.current;
      video.onplaying = () => qoeRef.current?.onPlaying();
      video.onwaiting = () => qoeRef.current?.onWaiting();
      video.onpause = () => qoeRef.current?.onPauseOrEnded();
      video.onended = async () => {
        qoeRef.current?.onPauseOrEnded();
        if (qoeTimerRef.current) clearInterval(qoeTimerRef.current);

        try {
          const payload = qoeRef.current?.snapshot();
          if (payload) {
            await postQoeEvent(payload);
            console.log("QoE posted:", payload);
          }
        } catch (e) {
          console.error("QoE post failed:", e);
        }
      };

      await video.play().catch(() => {});
      if (qoeTimerRef.current) clearInterval(qoeTimerRef.current);
      qoeTimerRef.current = setInterval(() => {
        qoeRef.current?.tick();
      }, 1000);
      setStatus("Playing (or ready to play)");
    } catch (e) {
      console.error(e);
      setStatus(`Error: ${e.message}`);
    }
  };

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h2>StreamForge Player</h2>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <button onClick={play}>Play video {videoId}</button>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <label style={{ fontFamily: "monospace" }}>
            Quality:&nbsp;
            <select
              value={qualityMode}
              onChange={(e) => applyQuality(e.target.value)}
              disabled={availableLevels.length === 0}
            >
              <option value="auto">Auto (ABR)</option>
              {availableLevels.map((l) => (
                <option key={l.idx} value={String(l.idx)}>
                  {`v${l.idx} (${l.height ?? "?"}p, ${l.bitrate ?? "?"} bps)`}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ fontFamily: "monospace" }}>{status}</div>
      </div>

      {playlistUrl ? (
        <div
          style={{ marginBottom: 12, fontFamily: "monospace", fontSize: 12 }}
        >
          Playlist: {playlistUrl}
        </div>
      ) : null}

      <div style={{ marginBottom: 12, fontFamily: "monospace" }}>
        <div>
          Current variant: {levelInfo.current ?? "-"} | height:{" "}
          {levelInfo.height ?? "-"} | bitrate: {levelInfo.bitrate ?? "-"}
        </div>

        {switches.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ marginBottom: 4 }}>Last switches:</div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {switches.map((s, i) => (
                <li key={i}>
                  {s.ts} → v{s.current} ({s.height ?? "?"}p, {s.bitrate ?? "?"}{" "}
                  bps)
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <video
        ref={videoRef}
        controls
        playsInline
        style={{ width: "100%", borderRadius: 8, background: "#000" }}
      />
    </div>
  );
}
