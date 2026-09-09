"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const WAKE_LOCK_RETRY_MS = 20 * 1000;

// A 1-second, 2x2, silent black clip. Some browsers (older Safari, Firefox,
// many smart-TV/embedded browsers) don't implement the Screen Wake Lock API
// at all, or silently refuse it -- looping a muted, playsInline video is the
// long-standing fallback ("NoSleep.js" trick) that keeps the screen/OS from
// treating the page as idle even there. Kept as an inline data URI so frame
// mode doesn't depend on fetching an extra asset.
const KEEP_AWAKE_VIDEO_SRC =
  "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMjbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAk50cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAIAAAACAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAPoAAAAAAABAAAAAAHGbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAKABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABcW1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAATFzdGJsAAAAuXN0c2QAAAAAAAAAAQAAAKlhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAIAAgBIAAAASAAAAAAAAAABFExhdmM2My4xLjEwMSBsaWJ4MjY0AAAAAAAAAAAAAAAAGP//AAAAL2F2Y0MBQsAK/+EAF2dCwArd+IiMBEAAAAMAQAAAAwKDxIngAQAFaM4PLIAAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAAAVyAAAAAAAAAAYc3R0cwAAAAAAAAABAAAABQAACAAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAUAAAABAAAAKHN0c3oAAAAAAAAAAAAAAAUAAAJxAAAAEgAAABIAAAASAAAAEgAAABRzdGNvAAAAAAAAAAEAAANTAAAAYXVkdGEAAABZbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAsaWxzdAAAACSpdG9vAAAAHGRhdGEAAAABAAAAAExhdmY2My4xLjEwMQAAAAhmcmVlAAACwW1kYXQAAAJeBgX//1rcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY1IHIzMjIzIDA0ODBjYjAgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDI1IC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MCByZWY9MSBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgxOjB4MTExIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTAgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0wIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MSBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTAgd2VpZ2h0cD0wIGtleWludD0xIGtleWludF9taW49MSBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmM9Y3JmIG1idHJlZT0wIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAC2WIhAS8mKAAOKOAAAAADmWIggFv///D0UAAU9/gAAAADmWIhAW///8PRQABT3+AAAAADmWIggFv///D0UAAU9/gAAAADmWIhAW///8PRQABT3+A";

/**
 * Fullscreen kiosk view for leaving the wallpaper running on a spare
 * tablet/monitor as a digital picture frame. Requests real Fullscreen API
 * fullscreen, a screen wake lock (re-acquired periodically and on
 * visibility regain), and loops a muted keep-awake video as a fallback for
 * browsers without Wake Lock support -- together these keep the display
 * from timing out or a screensaver from taking over. Also polls the
 * horoscope endpoint once a day so a new day's image picks up on its own.
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
  const videoRef = useRef<HTMLVideoElement>(null);

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
    let cancelled = false;
    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock?.request("screen");
        if (cancelled) {
          lock?.release().catch(() => {});
          return;
        }
        wakeLock = lock ?? null;
      } catch {
        // Not supported, or refused (e.g. low battery) -- the keep-awake
        // video below still covers most of these cases.
      }
    };
    acquire();
    // A wake lock can be silently dropped by the OS/browser outside of the
    // visibilitychange cases (e.g. some Android/Chrome builds after a
    // while); re-requesting periodically is cheap and self-healing.
    const retryId = setInterval(() => {
      if (!wakeLock) acquire();
    }, WAKE_LOCK_RETRY_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      cancelled = true;
      clearInterval(retryId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      wakeLock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    videoRef.current?.play().catch(() => {});
  }, []);

  useEffect(() => {
    const id = setInterval(onRefresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [onRefresh]);

  return (
    <div ref={containerRef} className="frame-mode" onClick={onExit} role="button" tabIndex={-1} aria-label="Exit frame view">
      <Image
        src={imageUrl}
        alt={`Today's horoscope wallpaper. Your luck today: ${luckScore}%.`}
        fill
        unoptimized
        priority
        className="frame-mode-image"
      />
      <video ref={videoRef} src={KEEP_AWAKE_VIDEO_SRC} muted loop autoPlay playsInline aria-hidden="true" className="frame-mode-keepawake" />
    </div>
  );
}
