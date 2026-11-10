import { NextRequest, NextResponse } from "next/server";
import { googleLoginUrl, googleOAuthConfigured } from "@/lib/google/oauth";

export async function GET(request: NextRequest) {
  if (!googleOAuthConfigured()) return NextResponse.redirect(new URL("/home?googleLogin=not-configured", request.nextUrl.origin));
  const guestId = request.nextUrl.searchParams.get("guestId");
  const validGuestId = guestId && /^[0-9a-f-]{36}$/i.test(guestId) ? guestId : null;
  return NextResponse.redirect(await googleLoginUrl(request, validGuestId));
}
