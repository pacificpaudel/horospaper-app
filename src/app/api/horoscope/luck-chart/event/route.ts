import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { sideOk } from "@/lib/image/luckChartShot";
import { googleAccessToken, googleConsentUrl, googleOAuthConfigured, type PendingEvent } from "@/lib/google/oauth";
import { NoLuckChartError, createLuckChartEvent } from "@/lib/google/luckChartEvent";
import { isPhysicalSymptomId, isSymptomRating, type PhysicalSymptomRatings } from "@/lib/physicalSymptoms";

/**
 * The Luck Chart's calendar icon:
 * POST { date, topic, w, h, preview? } makes an all-day Google Calendar
 * event for that day with the day's Luck Chart attached from the user's
 * Drive (see createLuckChartEvent).
 *
 * A guest who hasn't connected Google yet gets 401 { needsAuth, authUrl }:
 * the event they asked for is remembered with the consent state, so the
 * callback finishes it and lands them on the event itself.
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
  const { date, topic, symptoms, symptomRatings, w, h, preview } = (body ?? {}) as Record<string, unknown>;
  const width = Math.round(Number(w));
  const height = Math.round(Number(h));
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  if (!sideOk(width) || !sideOk(height)) return NextResponse.json({ error: "Invalid size" }, { status: 400 });
  if (symptoms !== undefined && (!Array.isArray(symptoms) || symptoms.length > 3 || symptoms.some((item) => !isPhysicalSymptomId(item)))) {
    return NextResponse.json({ error: "Select up to 3 valid traditional body signs" }, { status: 400 });
  }
  const symptomIds = Array.isArray(symptoms) ? [...new Set(symptoms as string[])] : [];
  if (symptomRatings !== undefined && (
    typeof symptomRatings !== "object" || symptomRatings === null || Array.isArray(symptomRatings) ||
    Object.entries(symptomRatings).some(([id, rating]) => !isPhysicalSymptomId(id) || !symptomIds.includes(id) || !isSymptomRating(rating))
  )) {
    return NextResponse.json({ error: "Invalid traditional body sign ratings" }, { status: 400 });
  }
  const ratings: PhysicalSymptomRatings = {};
  for (const [id, rating] of Object.entries((symptomRatings ?? {}) as Record<string, unknown>)) {
    if (isPhysicalSymptomId(id) && symptomIds.includes(id) && isSymptomRating(rating)) ratings[id] = rating;
  }

  const pending: PendingEvent = {
    userId: user.id,
    date,
    topic: (typeof topic === "string" ? topic.trim() : "").slice(0, 120) || `Luck Chart ${date}`,
    symptoms: symptomIds,
    symptomRatings: ratings,
    w: width,
    h: height,
    preview: preview === true,
  };

  const token = googleOAuthConfigured() ? await googleAccessToken(user.id) : null;
  if (googleOAuthConfigured() && !token) {
    return NextResponse.json({ needsAuth: true, authUrl: await googleConsentUrl(request, pending) }, { status: 401 });
  }

  try {
    return NextResponse.json(await createLuckChartEvent(token, pending, request.nextUrl.origin), { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    if (err instanceof NoLuckChartError) return NextResponse.json({ error: "No Luck Chart for that day" }, { status: 404 });
    console.error("[luck-chart event] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't create the event" }, { status: 502 });
  }
}
