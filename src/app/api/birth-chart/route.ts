import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/session";
import { fetchBirthChart } from "@/lib/astrologyApi";
import { isValidTimeZone } from "@/lib/validation";

const InputSchema = z.object({
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  timezone: z.string().refine(isValidTimeZone),
  // Geocentric planet positions don't depend on the observer, so a birth
  // place that isn't picked from the city list yet can fall back to 0,0.
  latitude: z.number().min(-90).max(90).default(0),
  longitude: z.number().min(-180).max(180).default(0),
  // All freeastrologyapi.com calls use Nepali.
  language: z.literal("ne").default("ne"),
});

/**
 * Birth-chart placements from freeastrologyapi.com for the birth-profile
 * form. `{ chart: null }` means "use the local calculation" (no API key,
 * daily quota spent, or the service is down).
 */
export async function POST(request: NextRequest) {
  // Guests only, like every other route -- keeps anonymous traffic from
  // burning the API's daily quota.
  if (!getCurrentUser(request)) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const parsed = InputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid birth details" }, { status: 400 });

  return NextResponse.json({ chart: await fetchBirthChart(parsed.data) });
}
