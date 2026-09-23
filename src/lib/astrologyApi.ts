import { createHash } from "node:crypto";
import { fromZonedTime, getTimezoneOffset } from "date-fns-tz";
import { redis, TTL_SECONDS } from "@/lib/redis";
import { formatSignPosition, NAKSHATRAS, nakshatraIndex, RASHIS } from "@/lib/astrology/rashi";
import type { Mahadasha } from "@/lib/astrology/vimshottari";
import { outlineChartSvg } from "@/lib/image/chartSvgOutline";

// Birth-chart placements from freeastrologyapi.com (Vedic, Lahiri
// ayanamsa), shown in the birth-profile form once a date of birth is
// entered. The key stays server-side (FREE_ASTROLOGY_API_KEY); results are
// cached per exact birth input, since the free plan allows 50 calls a day.

const API_BASE = "https://json.freeastrologyapi.com";
const REQUEST_TIMEOUT_MS = 10000;

export interface BirthChartInput {
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:mm
  timezone: string; // IANA
  latitude: number;
  longitude: number;
  /** Response language -- always Nepali ("ne"); planet names stay English either way. */
  language: "ne";
}

export interface ApiBirthChart {
  rashi: { name: string; nepali: string; sign: string };
  moon: string;
  moonNakshatra: string;
  saturn: string;
  mars: string;
  /** North-Indian (Nepali-style) kundli as SVG markup, or null if that call failed. */
  chartSvg: string | null;
  /** The Vimshottari Mahadasha running today, or null if that call failed. */
  mahadasha: { lord: string; start: string; end: string } | null;
  source: "freeastrologyapi";
}

// Dark palette matching the form's birth-chart panel.
const CHART_CONFIG = {
  font_family: "Roboto",
  hide_time_location: "True",
  hide_outer_planets: "True",
  chart_style: "north_india",
  native_name: "",
  chart_border_width: 1,
  planet_name_font_size: "20px",
  chart_heading_font_size: "20px",
  chart_background_color: "#080B16",
  chart_border_color: "#F7C56A",
  sign_number_font_color: "#9AA6C8",
  planet_name_font_color: "#FDF6E6",
  chart_heading_font_color: "#F7C56A",
  native_details_font_color: "#B8B2A4",
  native_name_font_color: "#B8B2A4",
};

interface ApiPlanet {
  name: string;
  fullDegree: number;
  current_sign: number;
}

function cacheKey(input: BirthChartInput): string {
  const digest = createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 32);
  return `birthchart:v2:${digest}`;
}

async function post<T>(path: string, apiKey: string, body: unknown, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new Error(`freeastrologyapi ${path} ${response.status}`);
  return (await response.json()) as T;
}

/** The chart comes back as SVG markup; only accept something that plainly is one. */
function parseChartSvg(output: unknown): string | null {
  return typeof output === "string" && output.trimStart().startsWith("<svg") ? output : null;
}

/**
 * The maha-dasas output is a JSON *string* of {"1": {Lord, start_time,
 * end_time}, ...} in birth-local time; pick the period covering today.
 */
function currentMahadasha(output: unknown): ApiBirthChart["mahadasha"] {
  const periods = typeof output === "string" ? (JSON.parse(output) as Record<string, { Lord: string; start_time: string; end_time: string }>) : null;
  if (!periods) return null;
  const today = new Date().toISOString().slice(0, 10);
  const current = Object.values(periods).find((p) => p.start_time.slice(0, 10) <= today && today < p.end_time.slice(0, 10));
  return current ? { lord: current.Lord, start: current.start_time.slice(0, 10), end: current.end_time.slice(0, 10) } : null;
}

/** A birth chart as sign numbers (1 = Aries) -- enough to draw a kundli. */
export interface KundliData {
  ascendantSign: number;
  planets: { name: string; sign: number; retro: boolean }[];
  /** All Vimshottari Mahadashas, so the one running on any given day can be shown. */
  mahadashas: Mahadasha[] | null;
  /**
   * The API's own chart SVG with its text outlined (see chartSvgOutline.ts)
   * -- pasted onto the wallpaper as-is, identical to the form's image.
   */
  chartSvg: string | null;
  source: "freeastrologyapi" | "local";
}

/** The maha-dasas output: a JSON *string* of {"1": {Lord, start_time, end_time}, ...}. */
function parseMahadashas(output: unknown): Mahadasha[] | null {
  try {
    const periods = typeof output === "string" ? (JSON.parse(output) as Record<string, { Lord: string; start_time: string; end_time: string }>) : null;
    if (!periods) return null;
    return Object.values(periods).map((p) => ({ lord: p.Lord, start: p.start_time.slice(0, 10), end: p.end_time.slice(0, 10) }));
  } catch {
    return null;
  }
}

const KUNDLI_PLANETS = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
const KUNDLI_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * The kundli for the wallpaper: one planets call (not the 3 the form's
 * preview makes), cached for a week because a birth chart never changes and
 * the wallpaper is rebuilt daily. Null when no key / quota spent / offline.
 */
export async function fetchKundli(input: Omit<BirthChartInput, "language">): Promise<KundliData | null> {
  const apiKey = process.env.FREE_ASTROLOGY_API_KEY;
  if (!apiKey) return null;

  const key = `kundli:v2:${createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 32)}`;
  const cached = await redis.get<KundliData>(key).catch(() => null);
  if (cached) return cached;

  const [year, month, date] = input.birthDate.split("-").map(Number);
  const [hours, minutes] = input.birthTime.split(":").map(Number);
  const birthUtc = fromZonedTime(`${input.birthDate}T${input.birthTime}:00`, input.timezone);
  const timezone = getTimezoneOffset(input.timezone, birthUtc) / 3_600_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const birth = {
    year, month, date, hours, minutes, seconds: 0,
    latitude: input.latitude,
    longitude: input.longitude,
    timezone,
    config: { observation_point: "geocentric", ayanamsha: "lahiri", language: "ne" },
  };
  try {
    // 3 calls per person per week: planets (required), plus the chart image
    // and maha-dasas (best effort).
    const [planetsResult, chartResult, dashaResult] = await Promise.allSettled([
      post<{ output?: Record<string, ApiPlanet & { isRetro?: string }>[] }>("planets", apiKey, birth, controller.signal),
      post<{ output?: unknown }>("horoscope-chart-svg-code", apiKey, { ...birth, chart_config: CHART_CONFIG }, controller.signal),
      post<{ output?: unknown }>("vimsottari/maha-dasas", apiKey, birth, controller.signal),
    ]);
    if (planetsResult.status === "rejected") throw planetsResult.reason;
    const payload = planetsResult.value;
    const entries = Object.values(payload.output?.[0] ?? {}).filter((p) => typeof p?.current_sign === "number");
    const ascendant = entries.find((p) => p.name === "Ascendant");
    if (!ascendant) throw new Error("freeastrologyapi response missing Ascendant");
    const kundli: KundliData = {
      ascendantSign: ascendant.current_sign,
      planets: entries
        .filter((p) => KUNDLI_PLANETS.includes(p.name))
        .map((p) => ({ name: p.name, sign: p.current_sign, retro: String(p.isRetro) === "true" })),
      mahadashas: dashaResult.status === "fulfilled" ? parseMahadashas(dashaResult.value.output) : null,
      chartSvg: (() => {
        const raw = chartResult.status === "fulfilled" ? parseChartSvg(chartResult.value.output) : null;
        return raw ? outlineChartSvg(raw) : null;
      })(),
      source: "freeastrologyapi",
    };
    await redis.set(key, kundli, { ex: KUNDLI_TTL_SECONDS }).catch(() => {});
    return kundli;
  } catch (err) {
    console.warn("[astrologyApi] kundli:", err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns the chart for `input`, or null when no key is configured, the
 * daily quota is spent, or the service is unreachable -- the form then
 * keeps showing its own (matching) local calculation.
 */
export async function fetchBirthChart(input: BirthChartInput): Promise<ApiBirthChart | null> {
  const apiKey = process.env.FREE_ASTROLOGY_API_KEY;
  if (!apiKey) return null;

  const key = cacheKey(input);
  const cached = await redis.get<ApiBirthChart>(key).catch(() => null);
  if (cached) return cached;

  const [year, month, date] = input.birthDate.split("-").map(Number);
  const [hours, minutes] = input.birthTime.split(":").map(Number);
  // The API wants a numeric UTC offset (e.g. 5.75), taken at the birth
  // instant itself so historical offsets and DST are respected.
  const birthUtc = fromZonedTime(`${input.birthDate}T${input.birthTime}:00`, input.timezone);
  const timezone = getTimezoneOffset(input.timezone, birthUtc) / 3_600_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const birth = {
    year, month, date, hours, minutes, seconds: 0,
    latitude: input.latitude,
    longitude: input.longitude,
    timezone,
    // Geocentric, like Nepali panchang and the app's own calculation.
    config: { observation_point: "geocentric", ayanamsha: "lahiri", language: input.language },
  };
  try {
    // One birth input = 3 calls against the 50/day free quota; the planets
    // call is essential, the chart image and dasha are best-effort extras.
    const [planetsResult, chartResult, dashaResult] = await Promise.allSettled([
      post<{ output?: Record<string, ApiPlanet>[] }>("planets", apiKey, birth, controller.signal),
      post<{ output?: unknown }>("horoscope-chart-svg-code", apiKey, { ...birth, chart_config: CHART_CONFIG }, controller.signal),
      post<{ output?: unknown }>("vimsottari/maha-dasas", apiKey, birth, controller.signal),
    ]);
    if (planetsResult.status === "rejected") throw planetsResult.reason;
    const planets = Object.values(planetsResult.value.output?.[0] ?? {}).filter((p): p is ApiPlanet => typeof p?.fullDegree === "number");
    const find = (name: string) => planets.find((p) => p.name === name);
    const moon = find("Moon");
    const saturn = find("Saturn");
    const mars = find("Mars");
    if (!moon || !saturn || !mars) throw new Error("freeastrologyapi response missing planets");

    const rashi = RASHIS[(moon.current_sign - 1 + 12) % 12];
    const chart: ApiBirthChart = {
      rashi: { name: rashi.name, nepali: rashi.nepali, sign: rashi.sign },
      moon: formatSignPosition(moon.fullDegree),
      moonNakshatra: NAKSHATRAS[nakshatraIndex(moon.fullDegree)],
      saturn: formatSignPosition(saturn.fullDegree),
      mars: formatSignPosition(mars.fullDegree),
      // Outlined like the wallpaper's copy, so both show the identical chart;
      // the raw SVG (browser-rendered text) only if some label can't be outlined.
      chartSvg: (() => {
        const raw = chartResult.status === "fulfilled" ? parseChartSvg(chartResult.value.output) : null;
        return raw ? (outlineChartSvg(raw) ?? raw) : null;
      })(),
      mahadasha: (() => {
        try {
          return dashaResult.status === "fulfilled" ? currentMahadasha(dashaResult.value.output) : null;
        } catch {
          return null;
        }
      })(),
      source: "freeastrologyapi",
    };
    await redis.set(key, chart, { ex: TTL_SECONDS }).catch(() => {});
    return chart;
  } catch (err) {
    console.warn("[astrologyApi]", err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
