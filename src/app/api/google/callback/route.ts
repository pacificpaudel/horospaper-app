import { NextRequest, NextResponse } from "next/server";
import { completeGoogleConsent, exchangeGoogleCode, googleRedirectUri, takeGoogleLoginState, takePendingEvent } from "@/lib/google/oauth";
import { createLuckChartEvent } from "@/lib/google/luckChartEvent";
import { getBirthProfile, saveBirthProfile } from "@/lib/profile";
import { getDailyPhysicalSymptoms, listPhysicalSymptomDates, saveDailyPhysicalSymptoms } from "@/lib/physicalSymptomLog";
import { setSessionCookie } from "@/lib/session";
import { migrateCalendarData } from "@/lib/userCalendar";

/**
 * Where Google returns from consent. The event the user filled in before
 * being sent there is remembered with the state, so this finishes the job
 * and redirects to whichever page the result is: the new event, or (if
 * Drive/Calendar refused) Google's pre-filled event page with the
 * screenshot's link. Anything else goes home with a reason in the URL,
 * which the home page turns into a message.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const home = (reason: string) => NextResponse.redirect(new URL(`/home?luckChartEvent=${reason}`, request.nextUrl.origin));

  if (params.get("error")) {
    const reason = params.get("error") === "access_denied" ? "declined" : "failed";
    return NextResponse.redirect(new URL(`/home?googleLogin=${reason}`, request.nextUrl.origin));
  }
  const code = params.get("code");
  const state = params.get("state") ?? "";
  const pending = await takePendingEvent(state);
  if (code && pending) {
    try {
      const token = await completeGoogleConsent(code, googleRedirectUri(request), pending.userId);
      const result = await createLuckChartEvent(token, pending, request.nextUrl.origin);
      return NextResponse.redirect(result.kind === "created" ? result.eventUrl : result.templateUrl);
    } catch (err) {
      console.error("[google callback] couldn't finish the event:", err instanceof Error ? err.message : err);
      return home("failed");
    }
  }

  const loginState = await takeGoogleLoginState(state);
  if (!code || !loginState) return NextResponse.redirect(new URL("/home?googleLogin=expired", request.nextUrl.origin));

  try {
    const accessToken = await exchangeGoogleCode(code, googleRedirectUri(request));
    const identityResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!identityResponse.ok) throw new Error(`Google profile request failed (${identityResponse.status})`);
    const identity = (await identityResponse.json()) as { sub?: string; email?: string; name?: string; email_verified?: boolean };
    if (!identity.sub || !identity.email || identity.email_verified === false) throw new Error("Google profile did not include a verified account id and email");
    const userId = `google:${identity.sub}`;

    if (loginState.guestId && loginState.guestId !== userId) {
      const [guestProfile, accountProfile] = await Promise.all([getBirthProfile(loginState.guestId), getBirthProfile(userId)]);
      if (guestProfile && !accountProfile) {
        await saveBirthProfile(userId, {
          name: guestProfile.name,
          birthDate: guestProfile.birthDate,
          birthTime: guestProfile.birthTime,
          birthTimeExact: guestProfile.birthTimeExact,
          birthLocation: guestProfile.birthLocation,
          latitude: guestProfile.latitude,
          longitude: guestProfile.longitude,
          timezone: guestProfile.timezone,
          astrologySystem: guestProfile.astrologySystem,
          language: guestProfile.language,
          imageStyle: guestProfile.imageStyle,
        });
      }
      const dates = await listPhysicalSymptomDates(loginState.guestId);
      for (const date of dates) {
        const [guestLog, accountLog] = await Promise.all([getDailyPhysicalSymptoms(loginState.guestId, date), getDailyPhysicalSymptoms(userId, date)]);
        if (guestLog && !accountLog) await saveDailyPhysicalSymptoms(userId, date, guestLog.symptoms, guestLog.ratings);
      }
      await migrateCalendarData(loginState.guestId, userId);
    }

    const response = NextResponse.redirect(new URL("/home", request.nextUrl.origin));
    setSessionCookie(response, { sub: userId, email: identity.email, name: identity.name ?? "" });
    return response;
  } catch (err) {
    console.error("[google callback] sign-in failed:", err instanceof Error ? err.message : err);
    return home("login-failed");
  }
}
