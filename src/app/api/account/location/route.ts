import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { getCurrentUser } from "@/lib/session";
import { nearestCity } from "@/lib/cities";

export interface AccountLocation {
  label: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

const locationKey = (userId: string) => `account-location:${userId}`;
const privateHeaders = { "Cache-Control": "private, no-store" };

function signedInUser(request: NextRequest) {
  const user = getCurrentUser(request);
  return user?.id.startsWith("google:") ? user : null;
}

export async function GET(request: NextRequest) {
  const user = signedInUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers: privateHeaders });
  const location = await redis.get<AccountLocation>(locationKey(user.id));
  return NextResponse.json({ location }, { headers: privateHeaders });
}

export async function POST(request: NextRequest) {
  const user = signedInUser(request);
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401, headers: privateHeaders });

  let body: { latitude?: unknown; longitude?: unknown; timezone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid location" }, { status: 400, headers: privateHeaders });
  }
  const { latitude, longitude, timezone } = body;
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
    || typeof timezone !== "string" || timezone.length > 100
    || !isValidTimeZone(timezone)) {
    return NextResponse.json({ error: "Invalid location" }, { status: 400, headers: privateHeaders });
  }

  const nearest = nearestCity(latitude, longitude);
  const location: AccountLocation = {
    label: nearest?.label ?? `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
    latitude,
    longitude,
    timezone,
  };
  await redis.set(locationKey(user.id), location);
  return NextResponse.json({ location }, { headers: privateHeaders });
}

function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

