import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { registerDevice } from "@/lib/devices";
import { deleteUserData, profileKey } from "@/lib/profile";
import { redis } from "@/lib/redis";
import { isValidTimeZone } from "@/lib/validation";

/**
 * The Android app registers its install here (POST { token, timezone }):
 * its Firebase push token, and the zone the phone is in, for the daily
 * morning notification. From then on the guest's birth profile is kept
 * until deleted (see profile.ts). DELETE stops the notifications and
 * deletes everything stored for the guest.
 */
export async function POST(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const timezone = typeof body?.timezone === "string" && isValidTimeZone(body.timezone) ? body.timezone : null;
  if (!token || token.length > 4096 || !timezone) return NextResponse.json({ error: "A push token and a valid timezone are required" }, { status: 400 });

  const device = await registerDevice(user.id, token, timezone);
  // Any profile already saved is now kept, not expired after 24 hours.
  await redis.persist(profileKey(user.id));
  return NextResponse.json({ registered: true, notifyHour: device.notifyHour });
}

export async function DELETE(request: NextRequest) {
  const user = getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  await deleteUserData(user.id);
  return NextResponse.json({ deleted: true });
}
