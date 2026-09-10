"use client";

import { useCallback, useEffect, useState } from "react";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { useIsMobileViewport } from "@/lib/client/useIsMobileViewport";
import Image from "next/image";
import { NavBar } from "@/components/NavBar";
import { FrameMode } from "@/components/FrameMode";
import { BirthProfileForm } from "@/components/BirthProfileForm";
import { CrystalBallScene } from "@/components/CrystalBallScene";
import { ensureGuestId } from "@/lib/client/guest";
import { apiFetch, ApiError } from "@/lib/client/api";
import { BirthProfileDTO, HoroscopeDTO } from "@/types/api";
import { calculateLuckScore } from "@/lib/luckScore";

// Header (5rem) + footer (4rem) chrome subtracted from the viewport height,
// and the output canvas's own max-w-6xl + padding subtracted from the
// width, to approximate the exact box the wallpaper actually renders into
// -- see .output-page's height budget and the <main> classes below.
const CHROME_PX = 144;
const CONTENT_MAX_WIDTH_PX = 1152; // max-w-6xl
const MD_BREAKPOINT_PX = 768;

function desktopViewportRatio(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const horizontalPadding = window.innerWidth >= MD_BREAKPOINT_PX ? 64 : 40; // md:px-8 vs px-5, both sides
  const availableWidth = Math.min(window.innerWidth, CONTENT_MAX_WIDTH_PX) - horizontalPadding;
  const availableHeight = window.innerHeight - CHROME_PX;
  return Math.max(1, availableWidth) / Math.max(1, availableHeight);
}

// A day's horoscope is keyed by the user's own local calendar date
// server-side (see todayForTimezone), so it's already correct to
// regenerate the instant that date rolls over -- not on a rolling "24h
// since this tab last checked" schedule, which could sit on yesterday's
// wallpaper for up to 24h after midnight if the tab happened to load a
// couple hours into the previous day. A little buffer past midnight avoids
// a request landing a few seconds early due to clock skew.
const MIDNIGHT_BUFFER_MS = 60_000;

function msUntilNextDayBoundary(timezone: string): number {
  const now = new Date();
  const zoned = toZonedTime(now, timezone);
  // Date.UTC normalizes month/year rollover for us; only used to get the
  // next day's y/m/d, not as a real instant.
  const next = new Date(Date.UTC(zoned.getFullYear(), zoned.getMonth(), zoned.getDate() + 1));
  const nextMidnightWallClock = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}T00:00:00`;
  const nextMidnightUtc = fromZonedTime(nextMidnightWallClock, timezone);
  return nextMidnightUtc.getTime() - now.getTime() + MIDNIGHT_BUFFER_MS;
}

// The luck-meter bar is baked into the image itself (see luckMeterOverlay.ts)
// so it's included in downloads and frame mode too -- alt text carries the
// score for accessibility instead of a duplicate on-page overlay.
function HoroscopeArtwork({ imageUrl, isMobile, luckScore }: { imageUrl: string; isMobile: boolean; luckScore: number }) {
  return (
    <div className="output-frame">
      <Image
        src={imageUrl}
        alt={`Today's horoscope wallpaper. Your luck today: ${luckScore}%.`}
        width={isMobile ? 1080 : 1920}
        height={isMobile ? 1920 : 1080}
        priority
        unoptimized
        className="output-image"
      />
    </div>
  );
}

export default function HomePage() {
  const [profile, setProfile] = useState<BirthProfileDTO | null | undefined>(undefined);
  const [horoscope, setHoroscope] = useState<HoroscopeDTO | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frameMode, setFrameMode] = useState(false);
  const isMobile = useIsMobileViewport();

  useEffect(() => {
    ensureGuestId();
    apiFetch<{ profile: BirthProfileDTO | null }>("/api/birth-profile")
      .then(({ profile: savedProfile }) => setProfile(savedProfile))
      .catch(() => setProfile(null));
  }, []);

  // Checks in at the next day boundary (in the profile's own timezone) so a
  // new day's horoscope picks up on its own, whether the app's been sitting
  // open for 2 hours or 20; the endpoint is idempotent for the current day,
  // so this is a no-op until the date actually rolls over. Reschedules
  // itself off a freshly computed delay each time rather than a flat 24h
  // interval, so it can't drift away from the actual boundary.
  const refreshHoroscope = useCallback(async () => {
    try {
      const { horoscope: latest } = await apiFetch<{ horoscope: HoroscopeDTO }>("/api/horoscope/generate", {
        method: "POST",
        body: JSON.stringify({ desktopRatio: isMobile ? undefined : desktopViewportRatio() }),
      });
      setHoroscope(latest);
    } catch {
      // Left running unattended, this shouldn't surface an error state.
    }
  }, [isMobile]);

  useEffect(() => {
    const timezone = profile?.timezone;
    if (!timezone) return;
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleNext = () => {
      timeoutId = setTimeout(() => {
        refreshHoroscope();
        scheduleNext();
      }, msUntilNextDayBoundary(timezone));
    };
    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [refreshHoroscope, profile?.timezone]);

  async function handleSaved(savedProfile: BirthProfileDTO) {
    setProfile(savedProfile);
    setError(null);
    setGenerating(true);
    try {
      const { horoscope: generated } = await apiFetch<{ horoscope: HoroscopeDTO }>("/api/horoscope/generate", {
        method: "POST",
        body: JSON.stringify({ refresh: true, desktopRatio: isMobile ? undefined : desktopViewportRatio() }),
      });
      setHoroscope(generated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create today's paper.");
    } finally {
      setGenerating(false);
    }
  }

  if (horoscope?.imageUrl) {
    const luckScore = calculateLuckScore(horoscope.astrologyData);
    const imageUrl = (isMobile && horoscope.imageUrlMobile) || horoscope.imageUrl;

    if (frameMode) {
      return <FrameMode imageUrl={imageUrl} luckScore={luckScore} onExit={() => setFrameMode(false)} />;
    }

    return (
      <div className="output-page flex min-h-0 flex-1 flex-col">
        <NavBar downloadUrl={imageUrl} onFrame={() => setFrameMode(true)} />
        <main className="output-canvas mx-auto w-full max-w-6xl px-5 md:px-8">
          <HoroscopeArtwork key={imageUrl} imageUrl={imageUrl} isMobile={isMobile} luckScore={luckScore} />
        </main>
      </div>
    );
  }

  return (
    <div className="home-shell flex min-h-0 flex-1 flex-col">
      <NavBar />
      <main className="home-main mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-2 pt-2 md:px-8">
        {profile === undefined ? (
          <div className="output-loader mx-auto mt-4" aria-label="Loading" />
        ) : generating ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="output-loader" aria-label="Creating your paper" />
          </div>
        ) : (
          <>
            <BirthProfileForm initialProfile={profile} onSaved={handleSaved} />
            <CrystalBallScene />
            {error && <p className="mt-3 text-center text-sm text-red-400">{error}</p>}
          </>
        )}
      </main>
    </div>
  );
}
