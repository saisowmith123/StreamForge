export function createSessionId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createQoeTracker({ sessionId, videoId }) {
  let playClickedAt = null;
  let firstPlayingAt = null;

  let rebufferCount = 0;
  let watchedMs = 0;

  let lastTickAt = null;
  let isPlaying = false;

  let currentVariant = null;

  function onPlayClicked() {
    playClickedAt = performance.now();
    firstPlayingAt = null;
    rebufferCount = 0;
    watchedMs = 0;
    lastTickAt = performance.now();
    isPlaying = false;
    currentVariant = null;
  }

  function onPlaying() {
    const now = performance.now();
    isPlaying = true;

    if (firstPlayingAt == null) {
      firstPlayingAt = now;
    }
    lastTickAt = now;
  }

  function onPauseOrEnded() {
    tick();
    isPlaying = false;
  }

  function onWaiting() {
    rebufferCount += 1;
    tick();
    isPlaying = false;
  }

  function tick() {
    if (!isPlaying) return;
    const now = performance.now();
    if (lastTickAt != null) {
      watchedMs += Math.max(0, now - lastTickAt);
    }
    lastTickAt = now;
  }

  function setVariant(levelIndex) {
    if (levelIndex == null || levelIndex < 0) return;
    currentVariant = String(levelIndex);
  }

  function snapshot() {
    const startupTimeMs =
      playClickedAt != null && firstPlayingAt != null
        ? Math.round(firstPlayingAt - playClickedAt)
        : null;

    return {
      sessionId,
      videoId: String(videoId),
      variant: currentVariant,
      startupTimeMs,
      rebufferCount,
      watchedMs: Math.round(watchedMs),
    };
  }

  return {
    onPlayClicked,
    onPlaying,
    onPauseOrEnded,
    onWaiting,
    tick,
    setVariant,
    snapshot,
  };
}
