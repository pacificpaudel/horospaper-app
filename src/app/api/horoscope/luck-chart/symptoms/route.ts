import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getDailyPhysicalSymptoms, saveDailyPhysicalSymptoms } from "@/lib/physicalSymptomLog";
import { isPhysicalSymptomId, isSymptomRating, type PhysicalSymptomId, type PhysicalSymptomRatings } from "@/lib/physicalSymptoms";

function readDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const date = readDate(request.nextUrl.searchParams.get("date"));
  if (!date) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  return NextResponse.json({ log: await getDailyPhysicalSymptoms(user.id, date) });
}

export async function PUT(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const date = readDate(typeof body?.date === "string" ? body.date : null);
  const symptoms = body?.symptoms;
  const ratings = body?.ratings;
  if (!date) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  if (!Array.isArray(symptoms) || symptoms.length > 3 || symptoms.some((id) => !isPhysicalSymptomId(id))) {
    return NextResponse.json({ error: "Select up to 3 valid traditional body signs" }, { status: 400 });
  }
  const symptomIds = [...new Set(symptoms as PhysicalSymptomId[])];
  if (ratings !== undefined && (
    typeof ratings !== "object" || ratings === null || Array.isArray(ratings) ||
    Object.entries(ratings).some(([id, rating]) => !isPhysicalSymptomId(id) || !symptomIds.includes(id) || !isSymptomRating(rating))
  )) {
    return NextResponse.json({ error: "Invalid traditional body sign ratings" }, { status: 400 });
  }
  const validatedRatings: PhysicalSymptomRatings = {};
  for (const [id, rating] of Object.entries((ratings ?? {}) as Record<string, unknown>)) {
    if (isPhysicalSymptomId(id) && symptomIds.includes(id) && isSymptomRating(rating)) validatedRatings[id] = rating;
  }
  const log = await saveDailyPhysicalSymptoms(user.id, date, symptomIds, validatedRatings);
  return NextResponse.json({ log }, { headers: { "Cache-Control": "private, no-store" } });
}
