import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { geocodeLocation } from "@/lib/geocode";
import { BirthProfileInputSchema } from "@/lib/validation";
import { dateOnlyUtc } from "@/lib/astrology/dailyData";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const profile = await prisma.birthProfile.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ profile });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (user.disabled) return NextResponse.json({ error: "Account disabled" }, { status: 403 });

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

  const data = {
    name: input.name || null,
    birthDate: dateOnlyUtc(new Date(`${input.birthDate}T00:00:00Z`)),
    birthTime: input.birthTime,
    birthLocation: geo.label,
    latitude: geo.latitude,
    longitude: geo.longitude,
    timezone: geo.timezone,
    astrologySystem: "VEDIC" as const,
    language: input.language,
    imageStyle: "MIXED_MEDIA" as const,
  };

  const profile = await prisma.birthProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });

  return NextResponse.json({ profile });
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await prisma.$transaction([
    prisma.horoscope.deleteMany({ where: { userId: user.id } }),
    prisma.generationUsage.deleteMany({ where: { userId: user.id } }),
    prisma.birthProfile.deleteMany({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({ ok: true });
}
