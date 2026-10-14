import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getCurrentUser } from "@/lib/session";
import { isValidTimeZone } from "@/lib/validation";
import { ensureTodaysHoroscope } from "@/lib/deviceHoroscope";
import { buildLuckChartWidgetSvg } from "@/lib/image/gocharOverlay";
import { readGeneratedFile } from "@/lib/storage";

// The Android app's home-screen widgets fetch their picture here:
// GET /api/widget/<luck-chart|analysis|wallpaper>?w=&h=&timezone= with the
// guest's x-guest-id header -> a PNG of exactly that size: today's Luck
// Chart, its Analysis, or the phone wallpaper. Today's horoscope is made
// first if the morning push hasn't made it yet.

export const maxDuration = 120;
const KINDS = { "luck-chart": "chart", analysis: "analysis", wallpaper: "wallpaper" } as const;
// Android caps a widget's picture at roughly the screen's size; widgets are far smaller.
const MIN_SIDE = 100;
const MAX_SIDE = 1600;

export async function GET(request: NextRequest, { params }: RouteContext<"/api/widget/[kind]">) {
  const { kind } = await params;
  const part = KINDS[kind as keyof typeof KINDS];
  if (!part) return NextResponse.json({ error: "Unknown widget" }, { status: 404 });
  const user = getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const search = request.nextUrl.searchParams;
  const width = Math.round(Number(search.get("w")));
  const height = Math.round(Number(search.get("h")));
  const sideOk = (n: number) => Number.isFinite(n) && n >= MIN_SIDE && n <= MAX_SIDE;
  if (!sideOk(width) || !sideOk(height)) return NextResponse.json({ error: "Invalid size" }, { status: 400 });
  const timezone = search.get("timezone");
  if (!timezone || !isValidTimeZone(timezone)) return NextResponse.json({ error: "Invalid timezone" }, { status: 400 });

  const horoscope = await ensureTodaysHoroscope(user.id, timezone);
  if (!horoscope) return NextResponse.json({ error: "No birth profile yet" }, { status: 404 });

  let png: Buffer;
  if (part === "wallpaper") {
    const url = horoscope.imageUrlMobile ?? horoscope.imageUrl;
    if (!url) return NextResponse.json({ error: "No wallpaper yet" }, { status: 404 });
    png = await sharp(await readGeneratedFile(url)).resize(width, height, { fit: "cover", position: "attention" }).png().toBuffer();
  } else {
    const kundli = horoscope.dailyReading?.kundli;
    if (!kundli) return NextResponse.json({ error: "No Luck Chart for today" }, { status: 404 });
    const svg = await buildLuckChartWidgetSvg(part, width, height, kundli, horoscope.generationDate);
    png = await sharp(Buffer.from(svg)).png().toBuffer();
  }
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Horoscope-Date": horoscope.generationDate },
  });
}
