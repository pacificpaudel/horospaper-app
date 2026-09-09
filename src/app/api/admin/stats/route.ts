import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { dateOnlyUtc } from "@/lib/astrology/dailyData";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = dateOnlyUtc(new Date());

  const [totalUsers, dailyGenerations, totalImages, failedGenerations, recentUsers, recentHoroscopes, recentErrors] =
    await Promise.all([
      prisma.user.count(),
      prisma.horoscope.count({ where: { generationDate: today } }),
      prisma.horoscope.count({ where: { imageUrl: { not: null } } }),
      prisma.generationError.count(),
      prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
      prisma.horoscope.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { name: true, email: true, isGuest: true } } },
      }),
      prisma.generationError.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    ]);

  return NextResponse.json({
    totalUsers,
    dailyGenerations,
    totalImages,
    failedGenerations,
    recentUsers,
    recentHoroscopes,
    recentErrors,
  });
}
