"use client";

import { useEffect, useState } from "react";
import { fromZonedTime } from "date-fns-tz";
import { BirthProfileDTO } from "@/types/api";
import { apiFetch, ApiError } from "@/lib/client/api";
import { adToBs, bsToAd } from "@/lib/nepaliDate";
import type { BirthSnapshot } from "@/lib/astrology/birthSnapshot";
import { DiagramPlanet, planetBodyMarkup } from "@/lib/image/planetBodies";

export type ViewMode = "DESKTOP" | "FRAME";

export interface BirthProfileFormValues {
  name: string;
  birthDate: string;
  /** Same day in Bikram Sambat, "YYYY-MM-DD" -- kept in sync with birthDate, never sent. */
  birthDateBs: string;
  birthTimePeriod: "MORNING" | "DAY" | "EVENING" | "NIGHT";
  birthLocation: string;
  timezone: string;
  astrologySystem: "VEDIC";
  language: "EN" | "NE" | "FI";
  imageStyle: "MIXED_MEDIA";
}

// A small, environment-independent fallback for browsers/runtimes without
// Intl.supportedValuesOf (older Safari) -- the primary path below covers
// virtually everyone in practice.
const FALLBACK_TIMEZONES = [
  "UTC", "Asia/Kathmandu", "Asia/Kolkata", "Asia/Dhaka", "Asia/Bangkok", "Asia/Shanghai",
  "Asia/Tokyo", "Asia/Dubai", "Australia/Sydney", "Europe/Helsinki", "Europe/London",
  "Europe/Paris", "Europe/Moscow", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Sao_Paulo", "Africa/Cairo", "Africa/Johannesburg", "Pacific/Auckland",
];

function listTimeZones(): string[] {
  try {
    const zones = Intl.supportedValuesOf?.("timeZone");
    return zones && zones.length ? zones : FALLBACK_TIMEZONES;
  } catch {
    return FALLBACK_TIMEZONES;
  }
}

const TIMEZONES = listTimeZones();

const BIRTH_TIME_PERIODS = [
  { value: "MORNING", label: "Morning", detail: "5:00 – 11:59" },
  { value: "DAY", label: "Day", detail: "12:00 – 16:59" },
  { value: "EVENING", label: "Evening", detail: "17:00 – 20:59" },
  { value: "NIGHT", label: "Night", detail: "21:00 – 4:59" },
] as const;

const PERIOD_TIMES = { MORNING: "09:00", DAY: "14:00", EVENING: "19:00", NIGHT: "23:00" } as const;

function periodFromTime(time?: string): BirthProfileFormValues["birthTimePeriod"] {
  const hour = Number(time?.slice(0, 2));
  if (hour >= 5 && hour < 12) return "MORNING";
  if (hour >= 12 && hour < 17) return "DAY";
  if (hour >= 17 && hour < 21) return "EVENING";
  return "NIGHT";
}

function defaultsFrom(profile?: BirthProfileDTO | null): BirthProfileFormValues {
  return {
    name: profile?.name ?? "",
    birthDate: profile?.birthDate?.slice(0, 10) ?? "",
    birthDateBs: profile?.birthDate ? adToBs(profile.birthDate.slice(0, 10)) ?? "" : "",
    birthTimePeriod: periodFromTime(profile?.birthTime),
    birthLocation: profile?.birthLocation ?? "",
    // The parent only renders this form once it already knows whether a
    // profile exists (see HomePage's `profile === undefined` loading gate),
    // so this never actually runs during the server-rendered pass -- safe
    // to read the browser's own timezone directly as the default for a new
    // profile, with no hydration-mismatch risk.
    timezone: profile?.timezone ?? (typeof window !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : ""),
    astrologySystem: "VEDIC",
    language: profile?.language ?? "EN",
    imageStyle: "MIXED_MEDIA",
  };
}

export function BirthProfileForm({
  initialProfile,
  onSaved,
  submitLabel = "Generate Today's Horoscope",
  viewMode,
  onViewModeChange,
}: {
  initialProfile?: BirthProfileDTO | null;
  onSaved: (profile: BirthProfileDTO) => void;
  submitLabel?: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}) {
  const [values, setValues] = useState<BirthProfileFormValues>(defaultsFrom(initialProfile));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function set<K extends keyof BirthProfileFormValues>(key: K, value: BirthProfileFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  // Whichever calendar the user types in, the other one fills itself.
  function setAdDate(ad: string) {
    setValues((v) => ({ ...v, birthDate: ad, birthDateBs: adToBs(ad) ?? "" }));
  }

  function setBsDate(bs: string) {
    const ad = bsToAd(bs);
    setValues((v) => ({ ...v, birthDateBs: bs, birthDate: ad ?? v.birthDate }));
    setErrors((current) => {
      const next = { ...current };
      delete next.birthDateBs;
      if (/^\d{4}-\d{2}-\d{2}$/.test(bs) && !ad) next.birthDateBs = "Not a valid BS date (2000-2090)";
      return next;
    });
  }

  const snapshot = useBirthSnapshot(values.birthDate, PERIOD_TIMES[values.birthTimePeriod], values.timezone);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!values.birthDate) next.birthDate = "Date of birth is required";
    if (values.birthDateBs && !bsToAd(values.birthDateBs)) next.birthDateBs = "Not a valid BS date (2000-2090)";
    if (!values.timezone) next.timezone = "Timezone is required";
    if (!values.birthTimePeriod) next.birthTimePeriod = "Time of birth is required";
    if (!values.birthLocation.trim()) next.birthLocation = "Birth location is required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const { profile } = await apiFetch<{ profile: BirthProfileDTO }>("/api/birth-profile", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          birthDate: values.birthDate,
          birthLocation: values.birthLocation,
          timezone: values.timezone,
          astrologySystem: values.astrologySystem,
          language: values.language,
          imageStyle: values.imageStyle,
          birthTime: PERIOD_TIMES[values.birthTimePeriod],
        }),
      });
      onSaved(profile);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Could not save your birth profile");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="birth-strip">
      <Field label="Rashi name">
        <input
          type="text"
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Rashi name"
          className="input"
          maxLength={80}
          required
        />
      </Field>

      <Field label="Date of birth (AD)" error={errors.birthDate}>
        <input
          type="date"
          value={values.birthDate}
          onChange={(e) => setAdDate(e.target.value)}
          className="input"
          required
        />
      </Field>

      <Field label="Date of birth (BS)" error={errors.birthDateBs}>
        <input
          type="text"
          inputMode="numeric"
          value={values.birthDateBs}
          onChange={(e) => setBsDate(e.target.value.trim())}
          placeholder="YYYY-MM-DD"
          title="Bikram Sambat date, year-month-day, e.g. 2047-01-15"
          className="input"
        />
      </Field>

      <Field label="Time of birth" error={errors.birthTimePeriod}>
        <select value={values.birthTimePeriod} onChange={(e) => set("birthTimePeriod", e.target.value as BirthProfileFormValues["birthTimePeriod"])} className="input">
          {BIRTH_TIME_PERIODS.map((period) => <option key={period.value} value={period.value}>{period.label}</option>)}
        </select>
      </Field>

      <Field label="Birth location" error={errors.birthLocation}>
        <input
          type="text"
          value={values.birthLocation}
          onChange={(e) => set("birthLocation", e.target.value)}
          placeholder="City, Country"
          className="input"
          required
        />
      </Field>

      <Field label="Birth timezone" error={errors.timezone}>
        <select value={values.timezone} onChange={(e) => set("timezone", e.target.value)} className="input" required>
          {!values.timezone && <option value="">Select timezone</option>}
          {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </Field>

      <Field label="View as">
        <select value={viewMode} onChange={(e) => onViewModeChange(e.target.value as ViewMode)} className="input">
          <option value="DESKTOP">Desktop</option>
          <option value="FRAME">Frame</option>
        </select>
      </Field>

      <button type="submit" disabled={submitting} className="primary-button birth-submit">
        {submitting ? "Making..." : submitLabel}
      </button>

      {snapshot && <BirthChartPanel snapshot={snapshot} />}

      {serverError && <p className="birth-error text-sm text-red-400">{serverError}</p>}

      <style jsx>{`
        :global(.birth-strip) {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr)) auto;
          align-items: end;
          gap: 0.65rem;
          width: 100%;
          padding: 0.65rem;
          border: 1px solid var(--border);
          border-radius: 1rem;
          background: rgba(16, 19, 34, 0.88);
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.16);
        }
        :global(.birth-strip label) { min-width: 0; }
        :global(.birth-strip .input) { min-width: 0; width: 100%; }
        :global(.birth-submit) { white-space: nowrap; min-height: 2.65rem; }
        :global(.birth-error) { grid-column: 1 / -1; }
        :global(.birth-chart) {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.65rem;
          padding: 0.75rem;
          border-radius: 0.8rem;
          background: #04060d;
          border: 1px solid rgba(247, 197, 106, 0.28);
        }
        :global(.birth-chart .input[readonly]) {
          background: #0b0f1c;
          border-color: rgba(255, 255, 255, 0.12);
          color: #fdf6e6;
          font-weight: 600;
          cursor: default;
        }
        :global(.birth-chart-cell) { display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; }
        :global(.birth-chart-visual) {
          display: flex; align-items: center; justify-content: center;
          height: 4.5rem; border-radius: 0.65rem; background: #080b16;
        }
        :global(.birth-chart-planet) { width: 4rem; height: 4rem; }
        :global(.birth-chart-sign) { font-size: 2.6rem; line-height: 1; color: #f7c56a; }
        :global(.birth-chart-note) { grid-column: 1 / -1; font-size: 0.72rem; color: #b8b2a4; }
        @media (max-width: 1080px) {
          :global(.birth-strip) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          :global(.birth-chart) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          :global(.birth-submit) { grid-column: 1 / -1; }
        }
        @media (max-width: 900px) {
          :global(.birth-strip) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 430px) {
          :global(.birth-strip) { grid-template-columns: 1fr; }
          :global(.birth-chart) { grid-template-columns: 1fr; }
        }
        :global(.input) {
          width: 100%; border-radius: 0.65rem; border: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.04); padding: 0.62rem 0.72rem;
          color: var(--foreground); font-size: 0.82rem;
        }
        :global(.input:focus) { outline: none; border-color: var(--accent); }
      `}</style>
    </form>
  );
}

/**
 * The natal Moon/Saturn/Mars placements and rashi for the entered birth
 * details, computed in the browser. astronomy-engine is loaded lazily so it
 * stays out of the page's initial bundle.
 */
function useBirthSnapshot(birthDate: string, birthTime: string, timezone: string): BirthSnapshot | null {
  const [snapshot, setSnapshot] = useState<BirthSnapshot | null>(null);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && Boolean(timezone);
  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    import("@/lib/astrology/birthSnapshot")
      .then(({ computeBirthSnapshot }) => {
        const birthUtc = fromZonedTime(`${birthDate}T${birthTime}:00`, timezone);
        if (!cancelled && !Number.isNaN(birthUtc.getTime())) setSnapshot(computeBirthSnapshot(birthUtc));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [valid, birthDate, birthTime, timezone]);
  return valid ? snapshot : null;
}

/** The same stylized body the wallpaper's corner diagrams draw, as a standalone icon. */
function PlanetImage({ planet, moonIllumination = 0.5 }: { planet: DiagramPlanet; moonIllumination?: number }) {
  // Saturn's ring reaches ~2.05r, so r=18 keeps every body inside the 80-unit box.
  const markup = planetBodyMarkup(planet, `birth-${planet}`, 18, moonIllumination);
  return <svg viewBox="-40 -40 80 80" className="birth-chart-planet" aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />;
}

function BirthChartPanel({ snapshot }: { snapshot: BirthSnapshot }) {
  const rows = [
    {
      label: "Horoscope sign (rashi)",
      value: `${snapshot.rashi.name} · ${snapshot.rashi.nepali} (${snapshot.rashi.sign})`,
      // U+FE0E asks for the plain text glyph rather than a colored emoji.
      visual: <span className="birth-chart-sign" aria-hidden="true">{snapshot.rashiSymbol}{"\uFE0E"}</span>,
    },
    {
      label: "Moon at birth",
      value: `${snapshot.moon} · ${snapshot.moonNakshatra}`,
      visual: <PlanetImage planet="moon" moonIllumination={snapshot.moonIllumination} />,
    },
    { label: "Saturn at birth", value: snapshot.saturn, visual: <PlanetImage planet="saturn" /> },
    { label: "Mars at birth", value: snapshot.mars, visual: <PlanetImage planet="mars" /> },
  ];
  return (
    <div className="birth-chart" aria-label="Your birth chart">
      {rows.map((row) => (
        <div key={row.label} className="birth-chart-cell">
          <Field label={row.label}>
            <input type="text" value={row.value} readOnly aria-readonly="true" tabIndex={-1} className="input" />
          </Field>
          <div className="birth-chart-visual">{row.visual}</div>
        </div>
      ))}
      <p className="birth-chart-note">Vedic (sidereal, Lahiri) positions. Birth time is taken from the chosen part of the day, so the Moon may be off by a few degrees.</p>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted">{label}</span>
      {children}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </label>
  );
}
