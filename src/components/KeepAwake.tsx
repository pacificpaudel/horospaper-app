"use client";

import { useEffect, useRef } from "react";

const WAKE_LOCK_RETRY_MS = 15 * 1000;

// A 1-second, 2x2, silent black clip. Some browsers (older Safari, Firefox,
// many smart-TV/embedded browsers) don't implement the Screen Wake Lock API
// at all, or silently refuse it -- looping a muted, playsInline video is the
// long-standing fallback ("NoSleep.js" trick) that keeps the screen/OS from
// treating the page as idle even there. Kept as an inline data URI so it
// doesn't depend on fetching an extra asset.
const KEEP_AWAKE_VIDEO_SRC =
  "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMjbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAk50cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAIAAAACAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAPoAAAAAAABAAAAAAHGbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAKABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABcW1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAATFzdGJsAAAAuXN0c2QAAAAAAAAAAQAAAKlhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAIAAgBIAAAASAAAAAAAAAABFExhdmM2My4xLjEwMSBsaWJ4MjY0AAAAAAAAAAAAAAAAGP//AAAAL2F2Y0MBQsAK/+EAF2dCwArd+IiMBEAAAAMAQAAAAwKDxIngAQAFaM4PLIAAAAAQcGFzcAAAAAEAAAABAAAAFGJ0cnQAAAAAAAAVyAAAAAAAAAAYc3R0cwAAAAAAAAABAAAABQAACAAAAAAcc3RzYwAAAAAAAAABAAAAAQAAAAUAAAABAAAAKHN0c3oAAAAAAAAAAAAAAAUAAAJxAAAAEgAAABIAAAASAAAAEgAAABRzdGNvAAAAAAAAAAEAAANTAAAAYXVkdGEAAABZbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAsaWxzdAAAACSpdG9vAAAAHGRhdGEAAAABAAAAAExhdmY2My4xLjEwMQAAAAhmcmVlAAACwW1kYXQAAAJeBgX//1rcRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY1IHIzMjIzIDA0ODBjYjAgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDI1IC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MCByZWY9MSBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgxOjB4MTExIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTAgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0wIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MSBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTAgd2VpZ2h0cD0wIGtleWludD0xIGtleWludF9taW49MSBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmM9Y3JmIG1idHJlZT0wIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAAC2WIhAS8mKAAOKOAAAAADmWIggFv///D0UAAU9/gAAAADmWIhAW///8PRQABT3+AAAAADmWIggFv///D0UAAU9/gAAAADmWIhAW///8PRQABT3+A";

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
 */
export function KeepAwake() {
  const videoRef = useRef<HTMLVideoElement>(null);

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
        if (!lock) return;
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        wakeLock = lock;
        // Released by the browser/OS, not us: take a new one.
        lock.addEventListener("release", () => {
          if (wakeLock === lock) wakeLock = null;
          if (!cancelled) setTimeout(acquire, 1000);
        });
      } catch {
        // Not supported, or refused (e.g. low battery, page not focused) --
        // retried below; the keep-awake video still covers most cases.
      } finally {
        pending = false;
      }
    };

    const revive = () => {
      if (document.visibilityState !== "visible") return;
      acquire();
      const video = videoRef.current;
      if (video?.paused) video.play().catch(() => {});
    };

    revive();
    const retryId = setInterval(revive, WAKE_LOCK_RETRY_MS);
    document.addEventListener("visibilitychange", revive);
    document.addEventListener("fullscreenchange", revive);
    window.addEventListener("focus", revive);
    window.addEventListener("pageshow", revive);
    return () => {
      cancelled = true;
      clearInterval(retryId);
      document.removeEventListener("visibilitychange", revive);
      document.removeEventListener("fullscreenchange", revive);
      window.removeEventListener("focus", revive);
      window.removeEventListener("pageshow", revive);
      wakeLock?.release().catch(() => {});
      wakeLock = null;
    };
  }, []);

  return (
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
  );
}
