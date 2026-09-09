import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getBirthProfile, saveBirthProfile, deleteUserData } from "@/lib/profile";
import { geocodeLocation } from "@/lib/geocode";
import { BirthProfileInputSchema } from "@/lib/validation";
import { dateOnlyString } from "@/lib/astrology/dailyData";

export async function GET(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const profile = await getBirthProfile(user.id);
  return NextResponse.json({ profile });
}

export async function POST(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = BirthProfileInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const input = parsed.data;

  let geo;
  try {
    geo = await geocodeLocation(input.birthLocation);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not resolve birth location";
    return NextResponse.json({ error: message }, { status: 422 });
  }

  const profile = await saveBirthProfile(user.id, {
    name: input.name || null,
    birthDate: dateOnlyString(new Date(`${input.birthDate}T00:00:00Z`)),
    birthTime: input.birthTime,
    birthLocation: geo.label,
    latitude: geo.latitude,
    longitude: geo.longitude,
    timezone: geo.timezone,
    astrologySystem: "VEDIC",
    language: input.language,
    imageStyle: "MIXED_MEDIA",
  });

  return NextResponse.json({ profile });
}

export async function DELETE(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await deleteUserData(user.id);
  return NextResponse.json({ ok: true });
}
