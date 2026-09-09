import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { generateHoroscopeForUser, HoroscopeGenerationError } from "@/lib/horoscope";
import { canConsumeGeneration, consumeGeneration, getFreeLimit } from "@/lib/usage";

/** Forces a fresh generation for an existing horoscope's day. Always counts against the daily budget. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (user.disabled) return NextResponse.json({ error: "Account disabled" }, { status: 403 });

  const { id } = await params;
  const existing = await prisma.horoscope.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const profile = await prisma.birthProfile.findUnique({ where: { userId: user.id } });
  if (!profile) {
    return NextResponse.json({ error: "Please complete your birth profile first" }, { status: 400 });
  }

  const allowed = await canConsumeGeneration(user.id);
  if (!allowed) {
    return NextResponse.json(
      { error: `You've reached today's limit of ${getFreeLimit()} extra generation(s). Come back tomorrow!` },
      { status: 429 }
    );
  }
  await consumeGeneration(user.id);

  try {
    const horoscope = await generateHoroscopeForUser({
      userId: user.id,
      profile,
      forDate: existing.generationDate,
      isPreview: existing.isPreview,
    });
    return NextResponse.json({ horoscope, cached: false });
  } catch (err) {
    if (err instanceof HoroscopeGenerationError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    console.error("[api/horoscope/regenerate] unexpected error", err);
    return NextResponse.json({ error: "Something went wrong regenerating your horoscope." }, { status: 500 });
  }
}
