"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { FullscreenButton } from "./FullscreenButton";
import { KeepAwake } from "./KeepAwake";

/**
 * Fullscreen kiosk view for leaving the wallpaper running on a spare
 * tablet/monitor as a digital picture frame. Requests real Fullscreen API
 * fullscreen (silently re-requesting it whenever the browser force-exits it
 * on its own -- an OS screen lock, a permission prompt, background-tab
 * power saving, waking from sleep -- rather than treating that as the user
 * wanting out), and KeepAwake holds the screen on (wake lock plus a
 * keep-awake video) so the display doesn't time out or a screensaver take
 * over. Clicking anywhere on the frame is the only way this view actually
 * exits. The parent page (not this component) is what checks in at the
 * next day boundary so a new day's image picks up on its own, since that
 * scheduler needs to keep running whether or not frame mode happens to be
 * open at the time.
 */
export function FrameMode({
  imageUrl,
  luckScore,
  onExit,
  children,
}: {
  imageUrl: string;
  luckScore: number;
  onExit: () => void;
  /** Drawn over the image, e.g. the clickable Luck Chart (LuckChartLayer). */
  children?: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.requestFullscreen?.().catch(() => {});
    // Native fullscreen gets force-exited by the browser for all sorts of
    // involuntary reasons on a device left running unattended -- an OS
    // screen lock, a permission/notification prompt, some browsers'
    // background-tab power saving, or just waking from sleep. Treating any
    // of those the same as "the user wants out" (by calling onExit here)
    // is what was kicking the kiosk back to the setup page on its own.
    // Instead, silently try to re-enter fullscreen; if that's refused
    // (most browsers require a fresh user gesture, which none of the above
    // triggers have), the .frame-mode CSS below still covers the full
    // viewport on its own, so the wallpaper keeps showing either way.
    // Explicitly clicking the frame (see onClick={onExit} below) is the
    // only way this view actually exits.
    const tryReenterFullscreen = () => {
      if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.().catch(() => {});
    };
    document.addEventListener("fullscreenchange", tryReenterFullscreen);
    document.addEventListener("visibilitychange", tryReenterFullscreen);
    return () => {
      document.removeEventListener("fullscreenchange", tryReenterFullscreen);
      document.removeEventListener("visibilitychange", tryReenterFullscreen);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  return (
    <div ref={containerRef} className="frame-mode" onClick={onExit} role="button" tabIndex={-1} aria-label="Exit frame view">
      <KeepAwake />
      <Image
        src={imageUrl}
        alt={`Today's horoscope wallpaper. Your luck today: ${luckScore}%.`}
        fill
        unoptimized
        priority
        className="frame-mode-image"
      />
      {children}
      {/* The browser refuses to re-enter fullscreen without a user gesture
          after it force-exits it (see above) -- this is that gesture. */}
      <FullscreenButton target={containerRef} className="download-button frame-mode-fullscreen" />
    </div>
  );
}
