import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const horoscopes = await prisma.horoscope.findMany({
    where: { userId: user.id },
    orderBy: { generationDate: "desc" },
    take: 60,
  });

  return NextResponse.json({ horoscopes });
}
