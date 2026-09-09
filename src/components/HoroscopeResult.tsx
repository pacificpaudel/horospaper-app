"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HoroscopeDTO } from "@/types/api";
import { apiFetch, ApiError } from "@/lib/client/api";
import { zodiacSymbol } from "@/lib/client/zodiacDisplay";
import { GlassCard } from "./GlassCard";

const SECTION_LABELS: { key: keyof HoroscopeDTO["horoscopeText"]; label: string }[] = [
  { key: "overall", label: "Overall" },
  { key: "love", label: "Love" },
  { key: "career", label: "Career" },
  { key: "money", label: "Money" },
  { key: "energy", label: "Energy" },
  { key: "focus", label: "Today's Focus" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function dailyLuckScore(horoscope: HoroscopeDTO) {
  const source = `${horoscope.id}${horoscope.astrologyData.today.moonPhaseName}${horoscope.horoscopeText.luckyTheme}`;
  return 58 + [...source].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 37;
}

export function HoroscopeResult({
  horoscope: initial,
  name,
  onUpdated,
}: {
  horoscope: HoroscopeDTO;
  name?: string | null;
  onUpdated?: (h: HoroscopeDTO) => void;
}) {
  const router = useRouter();
  const [horoscope, setHoroscope] = useState(initial);
  const [busy, setBusy] = useState<"regenerate" | "preview" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { astrologyData, horoscopeText } = horoscope;

  function update(h: HoroscopeDTO) {
    setHoroscope(h);
    onUpdated?.(h);
  }

  async function handleRegenerate() {
    setBusy("regenerate");
    setMessage(null);
    try {
      const { horoscope: fresh } = await apiFetch<{ horoscope: HoroscopeDTO }>(
        `/api/horoscope/${horoscope.id}/regenerate`,
        { method: "POST" }
      );
      update(fresh);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not regenerate right now.");
    } finally {
      setBusy(null);
    }
  }

  async function handleTomorrowPreview() {
    setBusy("preview");
    setMessage(null);
    try {
      const { horoscope: preview } = await apiFetch<{ horoscope: HoroscopeDTO }>("/api/horoscope/generate", {
        method: "POST",
        body: JSON.stringify({ preview: true }),
      });
      router.push(`/result/${preview.id}`);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not generate tomorrow's preview.");
    } finally {
      setBusy(null);
    }
  }

  function handleDownload() {
    if (!horoscope.imageUrl) return;
    const a = document.createElement("a");
    a.href = horoscope.imageUrl;
    a.download = `horospaper-${horoscope.generationDate.slice(0, 10)}`;
    a.click();
  }

  async function handleShare() {
    const shareData = {
      title: "horospaper",
      text: horoscopeText.overall,
      url: window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled -- no-op
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      setMessage("Link copied to clipboard.");
    }
  }

  async function handleCopy() {
    const text = [
      `horospaper — ${formatDate(horoscope.generationDate)}`,
      `${astrologyData.sunSign} · ${astrologyData.today.moonPhaseName}`,
      "",
      horoscopeText.overall,
      "",
      `Love: ${horoscopeText.love}`,
      `Career: ${horoscopeText.career}`,
      `Money: ${horoscopeText.money}`,
      `Energy: ${horoscopeText.energy}`,
      "",
      horoscopeText.motivation,
      "",
      horoscopeText.disclaimer,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setMessage("Horoscope copied to clipboard.");
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 md:grid-cols-[minmax(0,360px)_1fr]">
        <GlassCard className="overflow-hidden p-0">
          {horoscope.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={horoscope.imageUrl} alt="Your horoscope artwork" className="aspect-[4/5] w-full object-cover" />
          )}
          <div className="space-y-2 p-5">
            <p className="text-xs uppercase tracking-widest text-muted">
              {name || "Your"} · {formatDate(horoscope.generationDate)}
            </p>
            <p className="font-serif text-xl">
              {zodiacSymbol(astrologyData.sunSign)} {astrologyData.sunSign}
              {horoscope.isPreview ? " · Tomorrow's Preview" : " · Daily Horoscope"}
            </p>
            <p className="text-sm text-muted">{horoscopeText.motivation}</p>
          </div>
        </GlassCard>

        <div className="flex flex-col gap-4">
          <GlassCard>
            <h2 className="mb-2 font-serif text-xl">Today&apos;s Sky</h2>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Stat label="Sun sign" value={`${zodiacSymbol(astrologyData.today.sunSign)} ${astrologyData.today.sunSign}`} />
              <Stat label="Moon sign" value={`${zodiacSymbol(astrologyData.today.moonSign)} ${astrologyData.today.moonSign}`} />
              <Stat label="Moon phase" value={astrologyData.today.moonPhaseName} />
              <Stat label="Ascendant" value={astrologyData.ascendantSign ? `${zodiacSymbol(astrologyData.ascendantSign)} ${astrologyData.ascendantSign}` : "—"} />
              <Stat
                label="Retrograde"
                value={astrologyData.today.retrogradePlanets.length ? astrologyData.today.retrogradePlanets.join(", ") : "None"}
              />
              <Stat label="Lucky theme" value={horoscopeText.luckyTheme} />
            </dl>
            {astrologyData.transits.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="mb-1 text-xs uppercase tracking-wide text-muted">Key influences today</p>
                <ul className="space-y-1 text-sm text-muted">
                  {astrologyData.transits.slice(0, 3).map((t, i) => (
                    <li key={i}>{t.description}</li>
                  ))}
                </ul>
              </div>
            )}
          </GlassCard>

          <GlassCard>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted">Overall</p>
            <p className="text-sm leading-relaxed">{horoscopeText.overall}</p>
          </GlassCard>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTION_LABELS.filter((s) => s.key !== "overall").map(({ key, label }) => (
          <GlassCard key={key}>
            <p className="mb-2 text-xs uppercase tracking-wide text-muted">{label}</p>
            <p className="text-sm leading-relaxed">{horoscopeText[key] as string}</p>
          </GlassCard>
        ))}
      </div>

      <div className="mx-auto w-full max-w-md text-center">
        <div className="mb-2 flex items-end justify-between text-xs uppercase tracking-[0.18em] text-muted"><span>Daily luck</span><span className="font-semibold text-gold">{dailyLuckScore(horoscope)}%</span></div>
        <div className="luck-meter" role="progressbar" aria-label="Daily luck" aria-valuemin={0} aria-valuemax={100} aria-valuenow={dailyLuckScore(horoscope)}>
          <span style={{ width: `${dailyLuckScore(horoscope)}%` }} />
        </div>
        <p className="mt-3 text-xs text-muted">{horoscopeText.disclaimer}</p>
      </div>

      {message && <p className="text-center text-sm text-accent">{message}</p>}

      <div className="flex flex-wrap justify-center gap-3">
        <ActionButton onClick={handleRegenerate} disabled={busy !== null}>
          {busy === "regenerate" ? "Generating..." : "Generate Again"}
        </ActionButton>
        <ActionButton onClick={handleDownload} disabled={!horoscope.imageUrl}>
          Download Image
        </ActionButton>
        <ActionButton onClick={handleShare}>Share</ActionButton>
        <ActionButton onClick={handleCopy}>Copy Horoscope</ActionButton>
        {!horoscope.isPreview && (
          <ActionButton onClick={handleTomorrowPreview} disabled={busy !== null}>
            {busy === "preview" ? "Generating..." : "Generate Tomorrow's Preview"}
          </ActionButton>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
