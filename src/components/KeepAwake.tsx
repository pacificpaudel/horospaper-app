"use client";

import { useEffect, useRef, useState } from "react";

const WAKE_LOCK_RETRY_MS = 15 * 1000;

// A 10-second, 16x16 black clip with a silent audio track. Some browsers
// (older Safari, Firefox, many smart-TV/embedded browsers) don't implement
// the Screen Wake Lock API at all, or silently refuse it -- looping a
// playsInline video is the long-standing fallback ("NoSleep.js" trick) that
// keeps the screen/OS from treating the page as idle even there. The audio
// track is for smart displays like Meta Portal, whose own ambient-mode
// timer (5 min, not changeable) ignores the wake lock and a muted video;
// media that's actually playing sound is the one signal left that it may
// hold off for. So once the page has had a tap, the clip is unmuted (it's
// pure silence). It's 10s because Chromium ignores media under 5s as a
// media session. Kept as an inline data URI so it doesn't depend on
// fetching an extra asset.
const KEEP_AWAKE_VIDEO_SRC =
  "data:video/mp4;base64,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ACFoZGxyAAAAAAAAAABtZGlyYXBwbAAAAAAAAAAAAAAAACxpbHN0AAAAJKl0b28AAAAcZGF0YQAAAAEAAAAATGF2ZjYzLjEuMTAxAAAACGZyZWUAAAQ8bWRhdNwATGF2YzYzLjEuMTAxAAIwQA4AAAJyBgX//27cRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY1IHIzMjIzIDA0ODBjYjAgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDI1IC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MCByZWY9MyBkZWJsb2NrPTE6LTM6LTMgYW5hbHlzZT0weDE6MHgxMTEgbWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTIuMDA6MC43MCBtaXhlZF9yZWY9MSBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTEgOHg4ZGN0PTAgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTQgdGhyZWFkcz0xIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MCB3ZWlnaHRwPTAga2V5aW50PTI1MCBrZXlpbnRfbWluPTEgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjIwAIAAAAAPZYiEBfOf//8PRQABV5+AARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcAAAAHQZo4C+c6gAEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHAAAAB0GaVAL5zqABGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwAAAAZBmmAXznUBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwAAAAZBmoAXznUBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHARggBwAAAAZBmqAXznUBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHAAAABkGawBfOdQEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHAAAABkGa4BfOdQEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHAAAABkGbABfOdQEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAHAAAABkGbIBfOdQEYIAcBGCAHARggBwEYIAcBGCAHARggBwEYIAcBGCAH";

/**
 * Keeps the screen from dimming, sleeping or handing over to a screensaver
 * for as long as it's mounted. Holds a Screen Wake Lock, and -- since the
 * browser/OS drops that lock on its own (tab hidden, window minimized, some
 * Chrome builds after a while, waking from sleep) -- notices every release
 * and takes a new one: straight away when the page is visible, else as soon
 * as it's visible/focused again, with a periodic check as a safety net.
 * (Before, a dropped lock was never noticed, so the retry never fired and
 * the screensaver eventually won.) Also loops a muted keep-awake video for
 * browsers without Wake Lock. The video fills its positioned parent but is
 * transparent and ignores the pointer, because browsers only count a video
 * that's actually on screen at a decent size -- a 1px one is ignored.
 * Render it inside the full-screen view it should keep alive.
 *
 * When the wake lock can't be held it says so in a small corner note
 * rather than failing silently: the Wake Lock API only exists on HTTPS (or
 * localhost), so a tablet opening the app as http://<LAN-IP>:3000 never
 * gets one and Android's screen timeout wins -- locking the device and
 * ending fullscreen with it.
 */
export function KeepAwake() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    let pending = false;
    let cancelled = false;
    const isHeld = () => Boolean(wakeLock && !wakeLock.released);

    const acquire = async () => {
      if (cancelled || pending || isHeld() || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const lock = await navigator.wakeLock?.request("screen");
        if (!lock) {
          setProblem(
            window.isSecureContext
              ? "Screen may sleep: this browser has no keep-awake support"
              : "Screen may sleep: keep-awake needs HTTPS (or localhost)",
          );
          return;
        }
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        wakeLock = lock;
        setProblem(null);
        // Released by the browser/OS, not us: take a new one.
        lock.addEventListener("release", () => {
          if (wakeLock === lock) wakeLock = null;
          if (!cancelled) setTimeout(acquire, 1000);
        });
      } catch (err) {
        // Refused (e.g. battery saver, page not focused) -- retried below
        // and on the next tap; the keep-awake video still covers some cases.
        const reason = err instanceof Error && err.message ? err.message : "refused by the device";
        setProblem(`Screen may sleep: keep-awake ${reason}`);
      } finally {
        pending = false;
      }
    };

    // Autoplay is only allowed muted; unmuted (silent) playback needs the
    // page to have had a tap first -- the one that opened this view usually.
    // If the browser still refuses sound, fall back to playing muted.
    const playVideo = () => {
      const video = videoRef.current;
      if (!video) return;
      if (video.muted && navigator.userActivation?.hasBeenActive) video.muted = false;
      if (!video.paused) return;
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
      });
    };

    const revive = () => {
      if (document.visibilityState !== "visible") return;
      acquire();
      playVideo();
    };

    revive();
    const retryId = setInterval(revive, WAKE_LOCK_RETRY_MS);
    document.addEventListener("visibilitychange", revive);
    document.addEventListener("fullscreenchange", revive);
    window.addEventListener("focus", revive);
    window.addEventListener("pageshow", revive);
    // Some browsers only grant the lock after a user gesture.
    document.addEventListener("pointerdown", revive);
    return () => {
      cancelled = true;
      clearInterval(retryId);
      document.removeEventListener("visibilitychange", revive);
      document.removeEventListener("fullscreenchange", revive);
      window.removeEventListener("focus", revive);
      window.removeEventListener("pageshow", revive);
      document.removeEventListener("pointerdown", revive);
      wakeLock?.release().catch(() => {});
      wakeLock = null;
    };
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        src={KEEP_AWAKE_VIDEO_SRC}
        muted
        loop
        autoPlay
        playsInline
        disablePictureInPicture
        aria-hidden="true"
        tabIndex={-1}
        className="keep-awake-video"
      />
      {problem && <p className="keep-awake-note">{problem}</p>}
    </>
  );
}
