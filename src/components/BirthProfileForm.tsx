"use client";

import { useEffect, useState } from "react";
import { fromZonedTime } from "date-fns-tz";
import { BirthProfileDTO } from "@/types/api";
import { apiFetch, ApiError } from "@/lib/client/api";
import { adToBs, bsToAd } from "@/lib/nepaliDate";
import { BsDatePicker } from "./BsDatePicker";
import { CityDropdown, CityOption } from "./CityDropdown";
import type { BirthSnapshot } from "@/lib/astrology/birthSnapshot";
import { DiagramPlanet, planetBodyMarkup } from "@/lib/image/planetBodies";

export type ViewMode = "DESKTOP" | "FRAME";

export interface BirthProfileFormValues {
  name: string;
  birthDate: string;
  /** Same day in Bikram Sambat, "YYYY-MM-DD" -- kept in sync with birthDate, never sent. */
  birthDateBs: string;
  /** "EXACT" when the clock time is known, else the part of the day. */
  birthTimeMode: BirthTimeMode;
  /** "HH:mm", used when birthTimeMode is "EXACT". */
  birthTimeExact: string;
  birthLocation: string;
  /** Set when the location was picked from the city list; cleared on free-text edits. */
  birthCoords: { latitude: number; longitude: number } | null;
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

// Parts of the day for when the exact birth time isn't known. All of them
// fall on the entered birth date -- "Night" used to span 21:00-04:59 but
// was calculated as 23:00 on the birth date, putting an after-midnight
// birth ~21 hours (~11° of Moon travel) late.
const BIRTH_TIME_PERIODS = [
  { value: "MORNING", label: "Morning (5–12)", start: "05:00", end: "11:59", mid: "08:30" },
  { value: "DAY", label: "Day (12–17)", start: "12:00", end: "16:59", mid: "14:30" },
  { value: "EVENING", label: "Evening (17–21)", start: "17:00", end: "20:59", mid: "19:00" },
  { value: "NIGHT", label: "Night (21–24)", start: "21:00", end: "23:59", mid: "22:30" },
  { value: "LATE_NIGHT", label: "After midnight (0–5)", start: "00:00", end: "04:59", mid: "02:30" },
] as const;

type BirthPeriod = (typeof BIRTH_TIME_PERIODS)[number];
type BirthTimeMode = "EXACT" | BirthPeriod["value"];

function periodFor(mode: BirthTimeMode): BirthPeriod | undefined {
  return BIRTH_TIME_PERIODS.find((p) => p.value === mode);
}

function periodFromTime(time?: string): BirthPeriod["value"] {
  const hour = Number(time?.slice(0, 2));
  if (hour >= 5 && hour < 12) return "MORNING";
  if (hour >= 12 && hour < 17) return "DAY";
  if (hour >= 17 && hour < 21) return "EVENING";
  if (hour >= 21) return "NIGHT";
  return "LATE_NIGHT";
}

/** Initial time fields: exact for new profiles, else whatever the profile saved. */
function timeDefaults(profile?: BirthProfileDTO | null): Pick<BirthProfileFormValues, "birthTimeMode" | "birthTimeExact"> {
  if (!profile) return { birthTimeMode: "EXACT", birthTimeExact: "" };
  if (profile.birthTimeExact) return { birthTimeMode: "EXACT", birthTimeExact: profile.birthTime };
  return { birthTimeMode: periodFromTime(profile.birthTime), birthTimeExact: "" };
}

function defaultsFrom(profile?: BirthProfileDTO | null): BirthProfileFormValues {
  return {
    name: profile?.name ?? "",
    birthDate: profile?.birthDate?.slice(0, 10) ?? "",
    birthDateBs: profile?.birthDate ? adToBs(profile.birthDate.slice(0, 10)) ?? "" : "",
    ...timeDefaults(profile),
    birthLocation: profile?.birthLocation ?? "",
    // Coordinates are needed for the ascendant (lagna) in the kundli; a
    // saved profile already has them, and editing the location clears them.
    birthCoords: profile ? { latitude: profile.latitude, longitude: profile.longitude } : null,
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

  // A city from the list brings its own timezone and exact coordinates.
  function selectCity(city: CityOption) {
    setValues((v) => ({
      ...v,
      birthLocation: city.label,
      birthCoords: { latitude: city.latitude, longitude: city.longitude },
      timezone: city.timezone,
    }));
  }

  const period = periodFor(values.birthTimeMode);
  // With only a date so far, still show the panel -- judged across the
  // whole day -- rather than nothing, and prompt for the time.
  const timeMissing = !period && !values.birthTimeExact;
  const birthTime = period ? period.mid : values.birthTimeExact || "12:00";
  const chart = useBirthSnapshot({
    birthDate: values.birthDate,
    birthTime,
    window: period ? { start: period.start, end: period.end } : timeMissing ? { start: "00:00", end: "23:59" } : null,
    timezone: values.timezone,
    coords: values.birthCoords,
    language: "ne",
    timeMissing,
  });

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!values.birthDate) next.birthDate = "Date of birth is required";
    if (values.birthDateBs && !bsToAd(values.birthDateBs)) next.birthDateBs = "Not a valid BS date (2000-2090)";
    if (!values.timezone) next.timezone = "Timezone is required";
    if (values.birthTimeMode === "EXACT" && !values.birthTimeExact) next.birthTime = "Enter the time, or pick a part of the day";
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
          ...(values.birthCoords ?? {}),
          timezone: values.timezone,
          astrologySystem: values.astrologySystem,
          language: values.language,
          imageStyle: values.imageStyle,
          birthTime,
          birthTimeExact: values.birthTimeMode === "EXACT",
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
        <div className="bs-field">
          <input
            type="text"
            inputMode="numeric"
            value={values.birthDateBs}
            onChange={(e) => setBsDate(e.target.value.trim())}
            placeholder="YYYY-MM-DD"
            title="Bikram Sambat date, year-month-day, e.g. 2047-01-15"
            className="input"
          />
          <BsDatePicker value={values.birthDateBs} onSelect={setBsDate} />
        </div>
      </Field>

      <Field label="Time of birth" error={errors.birthTime}>
        <div className="birth-time">
          <select
            value={values.birthTimeMode}
            onChange={(e) => set("birthTimeMode", e.target.value as BirthTimeMode)}
            className="input"
            aria-label="How precisely you know your birth time"
          >
            <option value="EXACT">Exact time</option>
            {BIRTH_TIME_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          {values.birthTimeMode === "EXACT" && (
            <input
              type="time"
              value={values.birthTimeExact}
              onChange={(e) => set("birthTimeExact", e.target.value)}
              className="input"
              aria-label="Exact time of birth"
              required
            />
          )}
        </div>
      </Field>

      <Field label="Birth location" error={errors.birthLocation}>
        <CityDropdown
          value={values.birthLocation}
          onChange={(text) => setValues((v) => ({ ...v, birthLocation: text, birthCoords: null }))}
          onSelect={selectCity}
        />
      </Field>

      <Field label="Birth timezone" error={errors.timezone}>
        <select value={values.timezone} onChange={(e) => set("timezone", e.target.value)} className="input" required>
          {!values.timezone && <option value="">Select timezone</option>}
          {/* A city's zone can be an IANA alias the browser's own list spells
              differently (Asia/Kathmandu vs Chrome's Asia/Katmandu) -- keep it
              selectable rather than showing a blank select. */}
          {values.timezone && !TIMEZONES.includes(values.timezone) && <option value={values.timezone}>{values.timezone}</option>}
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

      {chart && <BirthChartPanel chart={chart} />}

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
        :global(.birth-time) { display: flex; flex-direction: column; gap: 0.35rem; }
        :global(.birth-chart-warning) { grid-column: 1 / -1; font-size: 0.78rem; color: #f7c56a; }
        :global(.city-dropdown) { position: relative; }
        :global(.city-dropdown .input) { padding-right: 1.8rem; }
        :global(.city-dropdown-caret) {
          position: absolute; top: 50%; right: 0.7rem; transform: translateY(-50%);
          font-size: 0.75rem; opacity: 0.7; pointer-events: none;
        }
        :global(.city-dropdown-list) {
          position: absolute; top: calc(100% + 0.4rem); left: 0; z-index: 60;
          width: max(100%, 16rem); max-height: 18rem; overflow-y: auto; padding: 0.3rem;
          border-radius: 0.8rem; border: 1px solid var(--border);
          background: #0b0f1c; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
        }
        :global(.city-dropdown-option) {
          display: flex; justify-content: space-between; gap: 0.75rem;
          padding: 0.45rem 0.6rem; border-radius: 0.5rem; font-size: 0.82rem; cursor: pointer;
        }
        :global(.city-dropdown-option[aria-selected="true"]) { background: rgba(242, 166, 90, 0.18); }
        :global(.city-dropdown-country) { color: #b8b2a4; font-size: 0.74rem; text-align: right; }
        :global(.city-dropdown-empty) { padding: 0.5rem 0.6rem; font-size: 0.78rem; color: #b8b2a4; }
        :global(.bs-field) { position: relative; }
        :global(.bs-field .input) { padding-right: 2.2rem; }
        :global(.bs-picker-toggle) {
          position: absolute; top: 50%; right: 0.45rem; transform: translateY(-50%);
          display: flex; padding: 0.25rem; border-radius: 0.4rem; color: var(--foreground); opacity: 0.8;
        }
        :global(.bs-picker-toggle:hover), :global(.bs-picker-toggle:focus-visible) { opacity: 1; background: rgba(255, 255, 255, 0.08); }
        :global(.bs-picker-panel) {
          position: absolute; top: calc(100% + 0.4rem); left: 0; z-index: 60; width: 17.5rem;
          padding: 0.7rem; border-radius: 0.8rem; border: 1px solid var(--border);
          background: #0b0f1c; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);
        }
        :global(.bs-picker-head) { display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.55rem; }
        :global(.bs-picker-select) {
          flex: 1; min-width: 0; border-radius: 0.5rem; border: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.05); color: var(--foreground); font-size: 0.8rem; padding: 0.3rem 0.4rem;
        }
        :global(.bs-picker-select option) { background: #0b0f1c; }
        :global(.bs-picker-nav) { width: 1.8rem; height: 1.8rem; border-radius: 0.5rem; font-size: 1.1rem; color: var(--foreground); }
        :global(.bs-picker-nav:hover:not(:disabled)) { background: rgba(255, 255, 255, 0.08); }
        :global(.bs-picker-nav:disabled) { opacity: 0.3; }
        :global(.bs-picker-grid) { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.2rem; text-align: center; }
        :global(.bs-picker-weekday) { font-size: 0.68rem; color: #b8b2a4; padding-bottom: 0.2rem; }
        :global(.bs-picker-day) { padding: 0.35rem 0; border-radius: 0.45rem; font-size: 0.8rem; color: var(--foreground); }
        :global(.bs-picker-day:hover) { background: rgba(242, 166, 90, 0.18); }
        :global(.bs-picker-day[aria-pressed="true"]) { background: var(--accent); color: #1a1208; font-weight: 700; }
        :global(.birth-chart-cell) { display: flex; flex-direction: column; gap: 0.5rem; min-width: 0; }
        :global(.birth-chart-visual) {
          display: flex; align-items: center; justify-content: center;
          flex: 1; min-height: 4.5rem; padding: 0.5rem; border-radius: 0.65rem; background: #080b16;
        }
        :global(.birth-chart-kundli) { display: flex; align-items: flex-start; gap: 0.5rem; width: 100%; justify-content: center; }
        :global(.birth-chart-kundli img) { width: min(100%, 12rem); aspect-ratio: 1; display: block; border-radius: 0.4rem; }
        :global(.birth-chart-sign-badge) { font-size: 1.6rem; }
        :global(.birth-chart-dasha) { grid-column: 1 / -1; font-size: 0.82rem; color: #fdf6e6; }
        :global(.birth-chart-dasha strong) { color: #f7c56a; }
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

interface BirthChartView {
  snapshot: BirthSnapshot;
  /** Every rashi possible across the chosen part of the day (1 = certain). */
  possibleRashis: string[];
  source: "freeastrologyapi" | "local";
  /** Kundli chart SVG (the API's, else the app's own), shown as an image. */
  chartSvg: string | null;
  mahadasha: { lord: string; start: string; end: string } | null;
  /** Only a date is entered so far -- the panel asks for the birth time. */
  timeMissing: boolean;
}

interface ApiChart {
  rashi: { name: string; nepali: string; sign: string };
  moon: string;
  moonNakshatra: string;
  saturn: string;
  mars: string;
  chartSvg: string | null;
  mahadasha: { lord: string; start: string; end: string } | null;
}

/**
 * The rashi and Moon/Saturn/Mars placements for the entered birth details.
 * Shown instantly from the local calculation (astronomy-engine, loaded
 * lazily to keep it out of the initial bundle), then replaced by
 * freeastrologyapi.com's answer once it arrives -- the two agree to within
 * a few hundredths of a degree, so the swap is rarely visible.
 */
function useBirthSnapshot({
  birthDate,
  birthTime,
  window,
  timezone,
  coords,
  language,
  timeMissing,
}: {
  birthDate: string;
  birthTime: string;
  window: { start: string; end: string } | null;
  timezone: string;
  coords: { latitude: number; longitude: number } | null;
  language: "ne";
  timeMissing: boolean;
}): BirthChartView | null {
  const [view, setView] = useState<BirthChartView | null>(null);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && /^\d{2}:\d{2}$/.test(birthTime) && Boolean(timezone);
  const windowStart = window?.start;
  const windowEnd = window?.end;
  const latitude = coords?.latitude;
  const longitude = coords?.longitude;

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    let apiTimer: ReturnType<typeof setTimeout> | undefined;
    Promise.all([import("@/lib/astrology/birthSnapshot"), import("@/lib/astrology/natalChart"), import("@/lib/image/kundliOverlay")])
      .then(([{ computeBirthSnapshot, rashisBetween, symbolForSign }, { computeNatalChart }, { kundliFromNatal, buildKundliSvg }]) => {
        const toUtc = (time: string) => fromZonedTime(`${birthDate}T${time}:00`, timezone);
        const birthUtc = toUtc(birthTime);
        if (cancelled || Number.isNaN(birthUtc.getTime())) return;
        const local = computeBirthSnapshot(birthUtc);
        const possibleRashis =
          windowStart && windowEnd ? rashisBetween(toUtc(windowStart), toUtc(windowEnd)).map((r) => r.name) : [local.rashi.name];
        // The app's own kundli (it matches the API's house for house), so a
        // chart shows even without the API. Needs the time (for the lagna)
        // and the birth place's coordinates.
        const localKundli =
          !timeMissing && latitude !== undefined && longitude !== undefined
            ? kundliFromNatal(computeNatalChart(birthUtc, latitude, longitude, "VEDIC"))
            : null;
        setView({
          snapshot: local,
          possibleRashis,
          source: "local",
          chartSvg: localKundli ? buildKundliSvg(localKundli) : null,
          mahadasha: (() => {
            const today = new Date().toISOString().slice(0, 10);
            return localKundli?.mahadashas?.find((p) => p.start <= today && today < p.end) ?? null;
          })(),
          timeMissing,
        });
        // A chart for an unknown time would be wrong, so don't spend API quota on it.
        if (timeMissing) return;

        // Debounced: the API's free plan allows 50 calls a day, so only ask
        // once the user has stopped editing.
        apiTimer = setTimeout(() => {
          apiFetch<{ chart: ApiChart | null }>("/api/birth-chart", {
            method: "POST",
            body: JSON.stringify({ birthDate, birthTime, timezone, latitude, longitude, language }),
          })
            .then(({ chart }) => {
              if (cancelled || !chart) return;
              setView({
                snapshot: {
                  ...local,
                  rashi: { ...local.rashi, ...chart.rashi, sign: chart.rashi.sign as BirthSnapshot["rashi"]["sign"] },
                  rashiSymbol: symbolForSign(chart.rashi.sign),
                  moon: chart.moon,
                  moonNakshatra: chart.moonNakshatra,
                  saturn: chart.saturn,
                  mars: chart.mars,
                },
                possibleRashis,
                source: "freeastrologyapi",
                chartSvg: chart.chartSvg ?? (localKundli ? buildKundliSvg(localKundli) : null),
                mahadasha: chart.mahadasha,
                timeMissing,
              });
            })
            .catch(() => {});
        }, 700);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      clearTimeout(apiTimer);
    };
  }, [valid, birthDate, birthTime, windowStart, windowEnd, timezone, latitude, longitude, language, timeMissing]);

  return valid ? view : null;
}

/** The same stylized body the wallpaper's corner diagrams draw, as a standalone icon. */
function PlanetImage({ planet, moonIllumination = 0.5 }: { planet: DiagramPlanet; moonIllumination?: number }) {
  // Saturn's ring reaches ~2.05r, so r=18 keeps every body inside the 80-unit box.
  const markup = planetBodyMarkup(planet, `birth-${planet}`, 18, moonIllumination);
  return <svg viewBox="-40 -40 80 80" className="birth-chart-planet" aria-hidden="true" dangerouslySetInnerHTML={{ __html: markup }} />;
}

function BirthChartPanel({ chart }: { chart: BirthChartView }) {
  const { snapshot, possibleRashis } = chart;
  const rows = [
    {
      label: "Horoscope sign (rashi)",
      value: `${snapshot.rashi.name} · ${snapshot.rashi.nepali} (${snapshot.rashi.sign})`,
      // U+FE0E asks for the plain text glyph rather than a colored emoji.
      visual: chart.chartSvg ? (
        <div className="birth-chart-kundli">
          {/* An <img> (not inline markup) so a third-party SVG can never run script in the page. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(chart.chartSvg)}`}
            alt={`Birth chart (kundli), North Indian style, Moon in ${snapshot.rashi.sign}`}
          />
          <span className="birth-chart-sign birth-chart-sign-badge" aria-hidden="true">{snapshot.rashiSymbol}{"\uFE0E"}</span>
        </div>
      ) : (
        <span className="birth-chart-sign" aria-hidden="true">{snapshot.rashiSymbol}{"\uFE0E"}</span>
      ),
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
      {chart.mahadasha && (
        <p className="birth-chart-dasha">
          Current Mahadasha: <strong>{chart.mahadasha.lord}</strong> ({chart.mahadasha.start.slice(0, 4)}–{chart.mahadasha.end.slice(0, 4)})
        </p>
      )}
      {chart.timeMissing ? (
        <p className="birth-chart-warning" role="status">
          {possibleRashis.length > 1
            ? `Your rashi is ${possibleRashis.join(" or ")} depending on your birth time. `
            : ""}
          Enter your time of birth to see your exact rashi and kundli.
        </p>
      ) : !chart.chartSvg ? (
        <p className="birth-chart-warning" role="status">
          Choose your birth place from the list to see your kundli -- the lagna depends on where you were born.
        </p>
      ) : (
        possibleRashis.length > 1 && (
          <p className="birth-chart-warning" role="status">
            Depending on your exact birth time, your rashi is {possibleRashis.join(" or ")} -- choose &quot;Exact time&quot; to be sure.
          </p>
        )
      )}
      <p className="birth-chart-note">
        Vedic (sidereal, Lahiri) positions{chart.source === "freeastrologyapi" ? " from freeastrologyapi.com" : ", calculated in your browser"}.
      </p>
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
