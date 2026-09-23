import { redis } from "@/lib/redis";
import { Rashi } from "@/lib/astrology/rashi";

// Nepali daily rashifal, read from Hamro Patro's public per-rashi page
// (https://www.hamropatro.com/rashifal/daily/<slug>). Only ever used as
// input for summarizing the day into luck + 2 tags -- the text itself is
// never shown or republished. Cached per (BS date, rashi), so at most 12
// fetches a day however many users generate.

const SOURCE_URL = "https://www.hamropatro.com/rashifal/daily/";
const REQUEST_TIMEOUT_MS = 6000;
const CACHE_TTL_SECONDS = 36 * 60 * 60;

export interface Rashifal {
  /** BS date the source says this reading is for, "YYYY-MM-DD". */
  bsDate: string;
  text: string;
  source: "hamropatro";
}

const DEVANAGARI_DIGITS = "०१२३४५६७८९";

// Both the colloquial and Sanskrit spellings are in common use.
const BS_MONTH_NAMES: string[][] = [
  ["बैशाख", "वैशाख"],
  ["जेठ", "जेष्ठ", "ज्येष्ठ"],
  ["असार", "आषाढ"],
  ["साउन", "श्रावण"],
  ["भदौ", "भाद्र"],
  ["असोज", "आश्विन"],
  ["कात्तिक", "कार्तिक"],
  ["मंसिर", "मङ्सिर", "मार्ग"],
  ["पुष", "पौष", "पुस"],
  ["माघ"],
  ["फागुन", "फाल्गुन"],
  ["चैत", "चैत्र"],
];

function toAsciiDigits(text: string): string {
  return text.replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)));
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Parses the page header's "०७ आश्विन  २०८३ बुधवार" into "2083-06-07". */
function parseHeaderBsDate(html: string): string | null {
  const match = /([०-९]{1,2})\s+([ऀ-ॿ]+)\s+([०-९]{4})/.exec(html);
  if (!match) return null;
  const monthIndex = BS_MONTH_NAMES.findIndex((names) => names.includes(match[2]));
  if (monthIndex < 0) return null;
  const day = toAsciiDigits(match[1]).padStart(2, "0");
  const year = toAsciiDigits(match[3]);
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${day}`;
}

function parseReading(html: string): string | null {
  const match = /<p class="whitespace-pre-line[^"]*">([\s\S]*?)<\/p>/.exec(html);
  if (!match) return null;
  const text = decodeEntities(match[1].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return text.length >= 40 ? text : null;
}

function cacheKey(bsDate: string, slug: string): string {
  return `rashifal:${bsDate}:${slug}`;
}

/**
 * Returns the rashifal for `rashi` on BS date `bsDate`, or null when the
 * source is unreachable, unparseable, or currently shows a different day
 * (Hamro Patro follows Nepal's own calendar day, which can run ahead of or
 * behind the user's) -- callers fall back to the planetary reading alone.
 */
export async function getDailyRashifal(rashi: Rashi, bsDate: string): Promise<Rashifal | null> {
  const cached = await redis.get<Rashifal>(cacheKey(bsDate, rashi.slug)).catch(() => null);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${SOURCE_URL}${rashi.slug}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; horospaper/1.0)", Accept: "text/html" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`rashifal fetch failed (${response.status})`);
    const html = await response.text();
    const pageDate = parseHeaderBsDate(html);
    const text = parseReading(html);
    if (!pageDate || !text) throw new Error("rashifal page layout not recognized");

    const reading: Rashifal = { bsDate: pageDate, text, source: "hamropatro" };
    // Cached under the date the page actually shows, so a fetch that lands
    // on "tomorrow" in Nepal is still reused once the user reaches that day.
    await redis.set(cacheKey(pageDate, rashi.slug), reading, { ex: CACHE_TTL_SECONDS }).catch(() => {});
    return pageDate === bsDate ? reading : null;
  } catch (err) {
    console.warn(`[rashifal] ${rashi.slug} ${bsDate}:`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
