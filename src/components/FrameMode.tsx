"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Fullscreen kiosk view for leaving the wallpaper running on a spare
 * tablet/monitor as a digital picture frame. Requests real Fullscreen API
 * fullscreen (so OS/browser chrome gets out of the way) and polls the
 * horoscope endpoint once a day so a new day's image picks up on its own.
 */
export function FrameMode({ imageUrl, onRefresh, onExit }: { imageUrl: string; onRefresh: () => void; onExit: () => void }) {
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
    const id = setInterval(onRefresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [onRefresh]);

  return (
    <div ref={containerRef} className="frame-mode" onClick={onExit} role="button" tabIndex={-1} aria-label="Exit frame view">
      <Image src={imageUrl} alt="" fill unoptimized priority className="frame-mode-image" />
    </div>
  );
}
