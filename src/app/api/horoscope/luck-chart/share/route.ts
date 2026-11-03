import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getExistingHoroscope } from "@/lib/horoscope";
import { buildLuckChartViewSvg } from "@/lib/image/gocharOverlay";
import { saveGeneratedFile } from "@/lib/storage";

const MIN_SIDE = 200;
const MAX_SIDE = 2400;

/**
 * A shareable picture of one day's Luck Chart:
 * POST { date, w, h, preview? } -> { imageUrl }, an absolute public URL of
 * the same view the full-screen Luck Chart shows, rasterized to PNG.
 *
 * Google Calendar's event template URL carries no attachments, so an event
 * made from the chart has to link the picture instead -- which means it
 * must live somewhere Calendar (and whoever the event is shared with) can
 * reach. The filename is a hash of the guest id and the date: stable, so
 * re-sharing the same day overwrites rather than piles up, and not
 * guessable by anyone who doesn't already have that guest id.
 */
export async function POST(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { date, w, h, preview } = (body ?? {}) as { date?: unknown; w?: unknown; h?: unknown; preview?: unknown };
  const width = Math.round(Number(w));
  const height = Math.round(Number(h));
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  const sideOk = (n: number) => Number.isFinite(n) && n >= MIN_SIDE && n <= MAX_SIDE;
  if (!sideOk(width) || !sideOk(height)) return NextResponse.json({ error: "Invalid size" }, { status: 400 });

  const horoscope = await getExistingHoroscope(user.id, new Date(`${date}T00:00:00Z`), preview === true);
  const kundli = horoscope?.dailyReading?.kundli;
  if (!horoscope?.dailyReading || !kundli) return NextResponse.json({ error: "No Luck Chart for that day" }, { status: 404 });

  const { svg } = await buildLuckChartViewSvg(width, height, kundli, horoscope.generationDate, horoscope.dailyReading.panchang);
  const sharp = (await import("sharp")).default;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  const token = createHash("sha256").update(`${user.id}:${date}`).digest("hex").slice(0, 32);
  const { url } = await saveGeneratedFile(`luck-chart-${token}.png`, png, "image/png");

  return NextResponse.json({ imageUrl: absolute(url, request) }, { headers: { "Cache-Control": "private, no-store" } });
}

/** Local storage returns a site-relative URL; Calendar needs a full one. */
function absolute(url: string, request: NextRequest): string {
  if (!url.startsWith("/")) return url;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return new URL(url, request.nextUrl.origin).toString();
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}${url}`;
}
