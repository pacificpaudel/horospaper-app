import { cityMapping } from "city-timezones";

// ~7,300 of the world's cities (Natural Earth populated places, via the
// city-timezones package), each with coordinates and an IANA timezone.
// Server-only: the dataset is ~2 MB, so the birth-location dropdown
// searches it through /api/cities instead of shipping it to the browser.

export interface City {
  /** "City, Country" -- what the form shows and saves. */
  label: string;
  timezone: string;
  latitude: number;
  longitude: number;
}

interface IndexedCity extends City {
  search: string;
  population: number;
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

let index: IndexedCity[] | null = null;

function cities(): IndexedCity[] {
  if (index) return index;
  const seen = new Set<string>();
  index = [...cityMapping]
    .filter((c) => c.timezone && Number.isFinite(c.lat) && Number.isFinite(c.lng))
    .sort((a, b) => b.pop - a.pop)
    .flatMap((c) => {
      const label = `${c.city}, ${c.country}`;
      // The source has a few duplicate rows; keep the most populous.
      if (seen.has(label)) return [];
      seen.add(label);
      return [{
        label,
        timezone: c.timezone,
        latitude: c.lat,
        longitude: c.lng,
        population: c.pop,
        search: normalize(`${c.city} ${c.city_ascii} ${c.country}`),
      }];
    });
  return index;
}

/**
 * Cities matching `query`, biggest first: names starting with the query
 * rank ahead of names merely containing it. An empty query returns the
 * world's largest cities, so the dropdown has something to show on open.
 */
export function searchCities(query: string, limit = 40): City[] {
  const q = normalize(query.trim());
  const all = cities();
  const strip = ({ label, timezone, latitude, longitude }: IndexedCity): City => ({ label, timezone, latitude, longitude });
  if (!q) return all.slice(0, limit).map(strip);

  const starts: IndexedCity[] = [];
  const contains: IndexedCity[] = [];
  for (const city of all) {
    if (city.search.startsWith(q)) starts.push(city);
    else if (city.search.includes(q)) contains.push(city);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit).map(strip);
}
