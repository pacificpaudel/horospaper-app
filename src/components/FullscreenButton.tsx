"use client";

import { RefObject, useEffect, useState } from "react";

/**
 * Puts `target` (the wallpaper's own container, not the whole page) into
 * native fullscreen, so the image fills the screen with no app chrome.
 * Hidden while that element is already fullscreen -- Esc (or the browser's
 * own control) exits.
 */
export function FullscreenButton({ target, className = "download-button" }: { target: RefObject<HTMLElement | null>; className?: string }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement) && document.fullscreenElement === target.current);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [target]);

  if (isFullscreen) return null;

  return (
    <button
      type="button"
      className={className}
      aria-label="Show the wallpaper fullscreen"
      onClick={(event) => {
        // Frame mode exits on any click on the frame -- this one shouldn't.
        event.stopPropagation();
        target.current?.requestFullscreen?.().catch(() => {});
      }}
    >
      <span aria-hidden="true">⛶</span>
      <span className="hidden sm:inline">Fullscreen</span>
    </button>
  );
}
