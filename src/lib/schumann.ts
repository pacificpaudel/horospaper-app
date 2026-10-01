// Live Schumann-resonance data from schumannresonance.today, drawn onto the
// wallpaper (see image/schumannOverlay.ts): the site's circular "calmness"
// gauge score and its live 3-day spectrogram from the Tomsk station. Both
// update roughly hourly at the source, so a snapshot is fetched at most
// once per UTC hour per server instance and shared by every wallpaper
// rendered in that hour.

const SITE_URL = "https://schumannresonance.today/";
const GRAPH_URL = "https://schumannresonance.today/live/tomsk1.jpg";
// The gauge's own fallback source (see the site's EnergyGauge component),
// used when its server-rendered score can't be read from the page.
const KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const REQUEST_TIMEOUT_MS = 8000;
const USER_AGENT = "Mozilla/5.0 (compatible; horospaper/1.0)";

// The Tomsk image is a fixed-format 1540x460 chart: a 1440x400 plot (72
// hours x 0-40 Hz) framed by tiny axis labels. Only the plot is kept --
// the wallpaper draws its own, much larger labels around it.
const GRAPH_SOURCE = { width: 1540, height: 460 };
const GRAPH_PLOT = { left: 60, top: 30, width: 1440, height: 400 };
const GRAPH_LOGO = { left: 1438, bottom: 102 };

export interface SchumannGraph {
  /** JPEG of the plot area only when `cropped`, else the whole source image. */
  jpeg: Buffer;
  width: number;
  height: number;
  /** True when `jpeg` is just the 72h x 0-40 Hz plot, with no axes of its own. */
  cropped: boolean;
  /** When the source image was last updated (its Last-Modified header). */
  updatedAt: Date;
  /** Tomsk-local "YYYY-MM-DD" of the plot's newest (rightmost) day. */
  lastDay: string;
}

/** Tomsk (the station) is UTC+7 year-round; the chart's hours are its local time. */
export const TOMSK_UTC_OFFSET_HOURS = 7;

function tomskDay(instant: Date): string {
  return new Date(instant.getTime() + TOMSK_UTC_OFFSET_HOURS * 3600_000).toISOString().slice(0, 10);
}

export interface SchumannSnapshot {
  /** UTC hour this snapshot belongs to, e.g. "2026-10-01T05". */
  hour: string;
  /** The site's 0-100 Earth-energy score, or null if unavailable. */
  score: number | null;
  graph: SchumannGraph | null;
}

/** The UTC hour bucket a wallpaper's Schumann data is refreshed on. */
export function currentSchumannHour(now = new Date()): string {
  return now.toISOString().slice(0, 13);
}

/** Same thresholds as the site's gauge. */
export function schumannLevel(score: number): "Calm" | "Moderate" | "Intense" | "Transformative" {
  return score <= 25 ? "Calm" : score <= 50 ? "Moderate" : score <= 75 ? "Intense" : "Transformative";
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  return response;
}

/** The score the site's gauge is server-rendered with, from its Astro island props. */
async function fetchSiteScore(): Promise<number> {
  const html = await (await fetchWithTimeout(SITE_URL)).text();
  const island = html.match(/<astro-island[^>]*EnergyGauge[^>]*>/)?.[0];
  const score = island?.match(/&quot;score&quot;:\[0,(\d+(?:\.\d+)?)\]/)?.[1];
  if (score === undefined) throw new Error("EnergyGauge score not found on page");
  return Math.max(0, Math.min(100, Math.round(Number(score))));
}

/** The gauge's own client-side fallback: latest planetary Kp, at its default amplitude of 5. */
async function fetchKpScore(): Promise<number> {
  const rows = (await (await fetchWithTimeout(KP_URL)).json()) as unknown[];
  const last = rows[rows.length - 1];
  const kp = Number(Array.isArray(last) ? last[1] : (last as { Kp?: number } | undefined)?.Kp) || 0;
  const kpPart = Math.min(1, Math.max(0, kp / 9));
  const amplitudePart = (5 - 1) / 9;
  return Math.min(100, Math.max(0, Math.round((kpPart * 0.6 + amplitudePart * 0.4) * 100)));
}

async function fetchScore(): Promise<number | null> {
  try {
    return await fetchSiteScore();
  } catch (err) {
    console.warn("[schumann] site score unavailable, falling back to NOAA Kp:", err instanceof Error ? err.message : err);
  }
  try {
    return await fetchKpScore();
  } catch (err) {
    console.warn("[schumann] Kp fallback failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function fetchGraph(): Promise<SchumannGraph | null> {
  try {
    const response = await fetchWithTimeout(GRAPH_URL);
    const lastModified = response.headers.get("last-modified");
    const updatedAt = lastModified && !Number.isNaN(Date.parse(lastModified)) ? new Date(lastModified) : new Date();
    const source = Buffer.from(await response.arrayBuffer());

    const sharp = (await import("sharp")).default;
    const metadata = await sharp(source).metadata();
    // Only crop when the chart is in its known layout; otherwise show it
    // whole, with its own (small) labels, rather than slicing it wrong.
    if (metadata.width === GRAPH_SOURCE.width && metadata.height === GRAPH_SOURCE.height) {
      // The station's "SOS 70" logo overlaps the plot's top-right corner;
      // it's blacked out (the data under it is already hidden in the source).
      const logo = { left: GRAPH_LOGO.left - GRAPH_PLOT.left, top: 0, width: GRAPH_PLOT.left + GRAPH_PLOT.width - GRAPH_LOGO.left, height: GRAPH_LOGO.bottom - GRAPH_PLOT.top };
      const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${logo.width}" height="${logo.height}"><rect width="100%" height="100%" fill="#000"/></svg>`);
      const plot = await sharp(source).extract(GRAPH_PLOT).toBuffer();
      const jpeg = await sharp(plot).composite([{ input: mask, left: logo.left, top: logo.top }]).jpeg({ quality: 88 }).toBuffer();
      // The newest day is normally the update's own Tomsk date. Right after
      // Tomsk midnight the chart may not have rolled over yet -- then its
      // last hour still holds data (it'd be empty on a freshly rolled day).
      const hourWidth = GRAPH_PLOT.width / 72;
      const lastHour = await sharp(source)
        .extract({ left: Math.round(GRAPH_PLOT.left + GRAPH_PLOT.width - hourWidth), top: GRAPH_PLOT.top, width: Math.round(hourWidth), height: GRAPH_PLOT.height })
        .stats();
      const lastHourHasData = lastHour.channels.slice(0, 3).some((channel) => channel.mean > 12);
      const lastDay = lastHourHasData ? tomskDay(new Date(updatedAt.getTime() - 3600_000)) : tomskDay(updatedAt);
      return { jpeg, width: GRAPH_PLOT.width, height: GRAPH_PLOT.height, cropped: true, updatedAt, lastDay };
    }
    const jpeg = await sharp(source).jpeg({ quality: 88 }).toBuffer();
    return { jpeg, width: metadata.width ?? GRAPH_SOURCE.width, height: metadata.height ?? GRAPH_SOURCE.height, cropped: false, updatedAt, lastDay: tomskDay(updatedAt) };
  } catch (err) {
    console.warn("[schumann] live graph unavailable:", err instanceof Error ? err.message : err);
    return null;
  }
}

let cached: { hour: string; snapshot: Promise<SchumannSnapshot> } | null = null;

/**
 * This hour's Schumann snapshot. Never throws: a part that couldn't be
 * fetched is null and simply isn't drawn, so the wallpaper still renders.
 */
export function getSchumannSnapshot(now = new Date()): Promise<SchumannSnapshot> {
  const hour = currentSchumannHour(now);
  if (cached?.hour !== hour) {
    const snapshot = Promise.all([fetchScore(), fetchGraph()]).then(([score, graph]) => ({ hour, score, graph }));
    cached = { hour, snapshot };
  }
  return cached.snapshot;
}
