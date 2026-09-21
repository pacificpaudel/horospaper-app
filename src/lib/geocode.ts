import { redis, TTL_SECONDS } from "@/lib/redis";

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  label: string;
}

// Small offline fallback so the app keeps working in dev with no network
// access. Real lookups go through OpenStreetMap Nominatim (free, no API key).
const OFFLINE_CITY_FALLBACK: Record<string, GeocodeResult> = {
  "kathmandu, nepal": { latitude: 27.7172, longitude: 85.324, label: "Kathmandu, Nepal" },
  "helsinki, finland": { latitude: 60.1699, longitude: 24.9384, label: "Helsinki, Finland" },
  "new york, usa": { latitude: 40.7128, longitude: -74.006, label: "New York, USA" },
  "london, uk": { latitude: 51.5072, longitude: -0.1276, label: "London, UK" },
};

function offlineLookup(query: string): GeocodeResult | null {
  const key = query.trim().toLowerCase();
  return OFFLINE_CITY_FALLBACK[key] ?? null;
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
  return { latitude: parseFloat(lat), longitude: parseFloat(lon), label: display_name };
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
 * Resolves a free-text birth location into coordinates, caching results for
 * 24h so repeat lookups (very common -- many people share a birth city)
 * don't hit the network every time. Timezone is no longer derived from
 * this -- it's picked directly by the user in the birth-profile form (see
 * BirthProfileInputSchema).
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
