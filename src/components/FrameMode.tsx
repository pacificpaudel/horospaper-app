"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Fullscreen kiosk view for leaving the wallpaper running on a spare
 * tablet/monitor as a digital picture frame. Requests real Fullscreen API
 * fullscreen and a screen wake lock (so it won't be interrupted by a
 * screensaver or display sleep), and polls the horoscope endpoint once a
 * day so a new day's image picks up on its own.
 */
export function FrameMode({
  imageUrl,
  luckScore,
  onRefresh,
  onExit,
}: {
  imageUrl: string;
  luckScore: number;
  onRefresh: () => void;
  onExit: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.requestFullscreen?.().catch(() => {});
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) onExit();
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    const acquire = async () => {
      try {
        wakeLock = (await navigator.wakeLock?.request("screen")) ?? null;
      } catch {
        // Not supported, or refused (e.g. low battery) -- frame still works, just without the guarantee.
      }
    };
    acquire();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      wakeLock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const id = setInterval(onRefresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [onRefresh]);

  return (
    <div ref={containerRef} className="frame-mode" onClick={onExit} role="button" tabIndex={-1} aria-label="Exit frame view">
      <Image src={imageUrl} alt="" fill unoptimized priority className="frame-mode-image" />
      <div className="luck-meter-panel">
        <div className="luck-meter-label">
          <span>Your luck today</span>
          <strong>{luckScore}%</strong>
        </div>
        <div className="luck-meter" role="progressbar" aria-label="Your luck today" aria-valuemin={0} aria-valuemax={100} aria-valuenow={luckScore}>
          <span style={{ width: `${luckScore}%` }} />
        </div>
      </div>
    </div>
  );
}
