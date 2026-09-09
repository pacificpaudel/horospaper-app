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

/**
 * The frame's aspect-ratio is set from the image's real natural size so the
 * luck-meter panel always aligns to the image's actual edges instead of a
 * box sized for an assumed ratio. It's known exactly for the mobile variant
 * (always generated at 1080x1920); for desktop it varies by provider, so we
 * start from a reasonable guess and correct it once the image loads. Keyed
 * by imageUrl at the call site so switching images resets this cleanly.
 */
function HoroscopeArtwork({ imageUrl, isMobile, luckScore }: { imageUrl: string; isMobile: boolean; luckScore: number }) {
  // Mobile's image is always exactly 1080x1920, so the frame is fitted to
  // that real ratio (no crop needed). Desktop's source ratio varies by
  // provider and isn't known ahead of time, so the frame instead fills the
  // canvas edge-to-edge and lets the image cover-crop into it.
  const [naturalRatio, setNaturalRatio] = useState(1080 / 1920);

  return (
    <div
      className={isMobile ? "output-frame output-frame--fit" : "output-frame output-frame--fill"}
      style={isMobile ? { aspectRatio: naturalRatio } : undefined}
    >
      <Image
        src={imageUrl}
        alt=""
        width={1080}
        height={isMobile ? 1920 : 1350}
        priority
        unoptimized
        className="output-image"
        onLoad={(e) => {
          if (!isMobile) return;
          const el = e.currentTarget;
          if (el.naturalWidth && el.naturalHeight) setNaturalRatio(el.naturalWidth / el.naturalHeight);
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
        body: JSON.stringify({}),
      });
      setHoroscope(latest);
    } catch {
      // A frame left running unattended shouldn't surface an error state.
    }
  }, []);

  async function handleSaved(savedProfile: BirthProfileDTO) {
    setProfile(savedProfile);
    setError(null);
    setGenerating(true);
    try {
      const { horoscope: generated } = await apiFetch<{ horoscope: HoroscopeDTO }>("/api/horoscope/generate", {
        method: "POST",
        body: JSON.stringify({ refresh: true }),
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
      return <FrameMode imageUrl={imageUrl} onRefresh={refreshHoroscope} onExit={() => setFrameMode(false)} />;
    }

    return (
      <div className="output-page flex min-h-0 flex-1 flex-col">
        <NavBar downloadUrl={imageUrl} onFrame={() => setFrameMode(true)} />
        <main className="output-canvas">
          <HoroscopeArtwork key={imageUrl} imageUrl={imageUrl} isMobile={isMobile} luckScore={luckScore} />
        </main>
      </div>
    );
  }

  return (
    <div className="home-shell flex min-h-0 flex-1 flex-col">
      <NavBar />
      <main className="home-main mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 pb-2 pt-2 sm:px-6">
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
