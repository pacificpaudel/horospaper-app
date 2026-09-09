"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { NavBar } from "@/components/NavBar";
import { BirthProfileForm } from "@/components/BirthProfileForm";
import { CrystalBallScene } from "@/components/CrystalBallScene";
import { ensureGuestId } from "@/lib/client/guest";
import { apiFetch, ApiError } from "@/lib/client/api";
import { BirthProfileDTO, HoroscopeDTO } from "@/types/api";
import { calculateLuckScore } from "@/lib/luckScore";

export default function HomePage() {
  const [profile, setProfile] = useState<BirthProfileDTO | null | undefined>(undefined);
  const [horoscope, setHoroscope] = useState<HoroscopeDTO | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureGuestId();
    apiFetch<{ profile: BirthProfileDTO | null }>("/api/birth-profile")
      .then(({ profile: savedProfile }) => setProfile(savedProfile))
      .catch(() => setProfile(null));
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

    return (
      <div className="output-page flex min-h-0 flex-1 flex-col">
        <NavBar downloadUrl={horoscope.imageUrl} />
        <main className="output-canvas">
          <Image src={horoscope.imageUrl} alt="" width={1080} height={1350} priority unoptimized className="output-image" />
          <div className="luck-meter-panel">
            <div className="luck-meter-label">
              <span>Your luck today</span>
              <strong>{luckScore}%</strong>
            </div>
            <div className="luck-meter" role="progressbar" aria-label="Your luck today" aria-valuemin={0} aria-valuemax={100} aria-valuenow={luckScore}>
              <span style={{ width: `${luckScore}%` }} />
            </div>
          </div>
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
