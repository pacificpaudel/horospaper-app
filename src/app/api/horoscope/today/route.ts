import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getExistingHoroscope } from "@/lib/horoscope";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const horoscope = await getExistingHoroscope(user.id, new Date(), false);
  return NextResponse.json({ horoscope });
}
