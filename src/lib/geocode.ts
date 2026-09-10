import { redis, TTL_SECONDS } from "@/lib/redis";

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  timezone: string;
  label: string;
}

// Small offline fallback so the app keeps working in dev with no network
// access. Real lookups go through OpenStreetMap Nominatim (free, no API key).
const OFFLINE_CITY_FALLBACK: Record<string, GeocodeResult> = {
  "kathmandu, nepal": { latitude: 27.7172, longitude: 85.324, timezone: "Asia/Kathmandu", label: "Kathmandu, Nepal" },
  "helsinki, finland": { latitude: 60.1699, longitude: 24.9384, timezone: "Europe/Helsinki", label: "Helsinki, Finland" },
  "new york, usa": { latitude: 40.7128, longitude: -74.006, timezone: "America/New_York", label: "New York, USA" },
  "london, uk": { latitude: 51.5072, longitude: -0.1276, timezone: "Europe/London", label: "London, UK" },
};

function offlineLookup(query: string): GeocodeResult | null {
  const key = query.trim().toLowerCase();
  return OFFLINE_CITY_FALLBACK[key] ?? null;
}

async function timezoneForCoordinates(lat: number, lon: number): Promise<string> {
  // Rough longitude-based UTC offset estimate, used only when a proper
  // timezone lookup service isn't configured. Good enough for MVP display;
  // does not account for DST or political timezone boundaries.
  const offsetHours = Math.round(lon / 15);
  // POSIX's Etc/GMT zones use inverted signs vs. common usage: Etc/GMT-6 is
  // UTC+6 (east of Greenwich), Etc/GMT+6 is UTC-6. Using the "intuitive"
  // sign here silently flipped every non-zero offset, which threw off both
  // birth-chart math (via birthDateTimeToUtc) and "today" for any location
  // more than a few degrees of longitude from 0 -- e.g. it labeled Kathmandu
  // (UTC+5:45, east) as 6 hours *behind* UTC instead of ahead.
  const sign = offsetHours >= 0 ? "-" : "+";
  return `Etc/GMT${sign}${Math.abs(offsetHours)}`;
}

async function fetchFromNominatim(query: string): Promise<GeocodeResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("accept-language", "en");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": process.env.GEOCODE_USER_AGENT || "horospaper-dev/1.0",
    },
  });
  if (!res.ok) return null;

  const results = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (!results.length) return null;

  const { lat, lon, display_name } = results[0];
  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);
  const timezone = await timezoneForCoordinates(latitude, longitude);

  return { latitude, longitude, timezone, label: display_name };
}

// Bumped to invalidate cached results computed with the pre-fix (sign-
// inverted) timezoneForCoordinates -- without this, anyone whose birth
// location was geocoded in the last 24h keeps getting the old wrong
// timezone back from cache even after the fix ships.
const GEOCODE_CACHE_VERSION = "v2";

function geocodeKey(query: string): string {
  return `geocode:${GEOCODE_CACHE_VERSION}:${query.toLowerCase()}`;
}

/**
 * Resolves a free-text birth location into coordinates + timezone,
 * caching results for 24h so repeat lookups (very common -- many people
 * share a birth city) don't hit the network every time.
 */
export async function geocodeLocation(query: string): Promise<GeocodeResult> {
  const normalized = query.trim();
  if (!normalized) throw new Error("Birth location is required");

  const key = geocodeKey(normalized);
  const cached = await redis.get<GeocodeResult>(key);
  if (cached) return cached;

  let result: GeocodeResult | null = null;
  try {
    result = await fetchFromNominatim(normalized);
  } catch {
    result = null;
  }
  if (!result) result = offlineLookup(normalized);
  if (!result) {
    throw new Error(
      `Could not find coordinates for "${normalized}". Try a more specific city, country.`
    );
  }

  await redis.set(key, result, { ex: TTL_SECONDS });
  return result;
}
