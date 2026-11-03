import { NextRequest, NextResponse } from "next/server";
import { completeGoogleConsent, googleRedirectUri, takePendingEvent } from "@/lib/google/oauth";
import { createLuckChartEvent } from "@/lib/google/luckChartEvent";

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

  if (params.get("error")) return home("declined");
  const code = params.get("code");
  const pending = await takePendingEvent(params.get("state") ?? "");
  if (!code || !pending) return home("expired");

  try {
    const token = await completeGoogleConsent(code, googleRedirectUri(request), pending.userId);
    const result = await createLuckChartEvent(token, pending, request.nextUrl.origin);
    return NextResponse.redirect(result.kind === "created" ? result.eventUrl : result.templateUrl);
  } catch (err) {
    console.error("[google callback] couldn't finish the event:", err instanceof Error ? err.message : err);
    return home("failed");
  }
}
