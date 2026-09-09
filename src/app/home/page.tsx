"use client";

import { useCallback, useEffect, useState } from "react";
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

// Mobile's canvas is always exactly 1080x1920. Desktop's is generated to
// match the caller's actual viewport at request time (see desktopRatio
// below), so it isn't known ahead of render -- start from a 16:9 guess and
// correct it once the real image reports its natural size. Either way, the
// frame is sized to the image's exact real ratio and never crops further,
// so the corner diagrams always stay at the image's 4 edges.
const MOBILE_RATIO = 1080 / 1920;
const DESKTOP_FALLBACK_RATIO = 16 / 9;

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

function HoroscopeArtwork({ imageUrl, isMobile, luckScore }: { imageUrl: string; isMobile: boolean; luckScore: number }) {
  const [ratio, setRatio] = useState(isMobile ? MOBILE_RATIO : DESKTOP_FALLBACK_RATIO);

  return (
    <div className="output-frame" style={{ aspectRatio: ratio }}>
      <Image
        src={imageUrl}
        alt=""
        width={isMobile ? 1080 : 1920}
        height={isMobile ? 1920 : 1080}
        priority
        unoptimized
        className="output-image"
        onLoad={(e) => {
          const el = e.currentTarget;
          if (el.naturalWidth && el.naturalHeight) setRatio(el.naturalWidth / el.naturalHeight);
        }}
      />
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

  // Left running in frame mode, checks in once a day so a new day's
  // horoscope picks up on its own; the endpoint is idempotent for the
  // current day, so this is a no-op until the date actually rolls over.
  const refreshHoroscope = useCallback(async () => {
    try {
      const { horoscope: latest } = await apiFetch<{ horoscope: HoroscopeDTO }>("/api/horoscope/generate", {
        method: "POST",
        body: JSON.stringify({ desktopRatio: isMobile ? undefined : desktopViewportRatio() }),
      });
      setHoroscope(latest);
    } catch {
      // A frame left running unattended shouldn't surface an error state.
    }
  }, [isMobile]);

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
      return <FrameMode imageUrl={imageUrl} isMobile={isMobile} onRefresh={refreshHoroscope} onExit={() => setFrameMode(false)} />;
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
