import { prisma } from "@/lib/prisma";

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
  const sign = offsetHours >= 0 ? "+" : "-";
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

/**
 * Resolves a free-text birth location into coordinates + timezone,
 * caching results in the database so repeat lookups (very common --
 * many users share a birth city) never hit the network twice.
 */
export async function geocodeLocation(query: string): Promise<GeocodeResult> {
  const normalized = query.trim();
  if (!normalized) throw new Error("Birth location is required");

  const cached = await prisma.geocodeCache.findUnique({ where: { query: normalized } });
  if (cached) {
    return {
      latitude: cached.latitude,
      longitude: cached.longitude,
      timezone: cached.timezone,
      label: cached.label,
    };
  }

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

  await prisma.geocodeCache.create({
    data: {
      query: normalized,
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone,
      label: result.label,
    },
  });

  return result;
}
