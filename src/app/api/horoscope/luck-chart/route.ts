import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getExistingHoroscope } from "@/lib/horoscope";
import { buildLuckChartViewSvg } from "@/lib/image/gocharOverlay";

const MIN_SIDE = 200;
const MAX_SIDE = 8000;

/**
 * The full-screen Luck Chart view for one of the user's stored horoscopes:
 * GET ?date=YYYY-MM-DD&w=&h=[&preview=1] returns an SVG of just its Luck
 * Chart and Analysis, laid out for a w x h screen. Drawn from the stored
 * reading -- no astrology, LLM or image work beyond the drawing itself.
 */
export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const date = params.get("date") ?? "";
  const width = Math.round(Number(params.get("w")));
  const height = Math.round(Number(params.get("h")));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  const sideOk = (n: number) => Number.isFinite(n) && n >= MIN_SIDE && n <= MAX_SIDE;
  if (!sideOk(width) || !sideOk(height)) return NextResponse.json({ error: "Invalid size" }, { status: 400 });

  const horoscope = await getExistingHoroscope(user.id, new Date(`${date}T00:00:00Z`), params.get("preview") === "1");
  const kundli = horoscope?.dailyReading?.kundli;
  if (!horoscope?.dailyReading || !kundli) return NextResponse.json({ error: "No Luck Chart for that day" }, { status: 404 });

  const svg = await buildLuckChartViewSvg(width, height, kundli, horoscope.generationDate, horoscope.dailyReading.panchang);
  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
