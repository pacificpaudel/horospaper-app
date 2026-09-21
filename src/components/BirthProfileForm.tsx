"use client";

import { useState } from "react";
import { BirthProfileDTO } from "@/types/api";
import { apiFetch, ApiError } from "@/lib/client/api";

export type ViewMode = "DESKTOP" | "FRAME";

export interface BirthProfileFormValues {
  name: string;
  birthDate: string;
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

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!values.birthDate) next.birthDate = "Date of birth is required";
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
          ...values,
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

      <Field label="Date of birth" error={errors.birthDate}>
        <input
          type="date"
          value={values.birthDate}
          onChange={(e) => set("birthDate", e.target.value)}
          className="input"
          required
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

      <Field label="Timezone" error={errors.timezone}>
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

      {serverError && <p className="birth-error text-sm text-red-400">{serverError}</p>}

      <style jsx>{`
        :global(.birth-strip) {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr)) auto;
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
        @media (max-width: 1080px) {
          :global(.birth-strip) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          :global(.birth-submit) { grid-column: 1 / -1; }
        }
        @media (max-width: 900px) {
          :global(.birth-strip) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 430px) {
          :global(.birth-strip) { grid-template-columns: 1fr; }
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

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-muted">{label}</span>
      {children}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </label>
  );
}
