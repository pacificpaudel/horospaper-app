import { fromZonedTime } from "date-fns-tz";
import { NextRequest, NextResponse } from "next/server";
import { calculateLuckFactors } from "@/lib/astrology/luckFactors";
import { computeGochar } from "@/lib/astrology/gochar";
import { computeNatalChart } from "@/lib/astrology/natalChart";
import { getMoonPhase, getPlanetPosition } from "@/lib/astrology/ephemeris";
import { getBirthProfile } from "@/lib/profile";
import { getCurrentUser } from "@/lib/session";
import { todayForTimezone } from "@/lib/timezoneDay";
import { isValidTimeZone } from "@/lib/validation";
import { getDailyPhysicalSymptoms } from "@/lib/physicalSymptomLog";
import { getArchivedCalendarDays, getCalendarNotes, saveCalendarNote } from "@/lib/userCalendar";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function monthDates(month: string, lastDate: string): string[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const lastDay = month === lastDate.slice(0, 7) ? Math.min(monthEnd, Number(lastDate.slice(8, 10))) : monthEnd;
  return Array.from({ length: lastDay }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

function currentDateForZone(timezone: string): string {
  return todayForTimezone(new Date(), timezone).toISOString().slice(0, 10);
}

function accountUser(request: NextRequest) {
  const user = getCurrentUser(request);
  return user?.id.startsWith("google:") ? user : null;
}

export async function GET(request: NextRequest) {
  const user = accountUser(request);
  if (!user) return NextResponse.json({ error: "Sign in with Google to open your calendar" }, { status: 401 });
  const profile = await getBirthProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Complete your birth profile to use the calendar" }, { status: 400 });

  const params = request.nextUrl.searchParams;
  const month = params.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: "Invalid month" }, { status: 400 });
  const timezone = params.get("timezone");
  const displayTimezone = timezone && isValidTimeZone(timezone) ? timezone : profile.timezone;
  const today = currentDateForZone(displayTimezone);
  if (month > today.slice(0, 7)) return NextResponse.json({ error: "Future months are not available yet" }, { status: 400 });
  const dates = monthDates(month, today);

  const [archives, notes] = await Promise.all([
    getArchivedCalendarDays(user.id, dates),
    getCalendarNotes(user.id, dates),
  ]);
  const symptoms = await Promise.all(dates.map((date) => getDailyPhysicalSymptoms(user.id, date)));
  const birthInstant = fromZonedTime(`${profile.birthDate}T${profile.birthTime}:00`, profile.timezone);
  const natalChart = computeNatalChart(birthInstant, profile.latitude, profile.longitude, profile.astrologySystem);
  const natalMoon = natalChart.planets.moon.longitude;

  const days = dates.map((date, index) => {
    const archived = archives.get(date);
    const phase = archived ? null : getMoonPhase(new Date(`${date}T12:00:00Z`));
    const noon = new Date(`${date}T12:00:00Z`);
    const transit = computeGochar(natalMoon, noon);
    const actualReading = archived?.reading;
    const luckCalculation = actualReading?.luckCalculation ?? calculateLuckFactors({
      natalChart,
      sunLongitude: getPlanetPosition("sun", noon).longitude,
      moonLongitude: getPlanetPosition("moon", noon).longitude,
      planetary: transit,
      panchang: actualReading?.panchang?.data ?? null,
      date,
    });
    return {
      date,
      luckScore: Math.round(luckCalculation.weightedScore),
      isEstimate: !actualReading?.luckCalculation,
      moonPhase: archived?.moonPhaseName ?? phase!.phaseName,
      moonIllumination: archived ? Math.round(archived.moonIllumination * 100) : Math.round(phase!.illumination * 100),
      panchang: actualReading?.panchang?.data ?? null,
      auspiciousSummary: actualReading?.panchang?.insight?.summary ?? null,
      suitableActivities: actualReading?.panchang?.insight?.suitableActivities ?? [],
      luckChartAvailable: Boolean(actualReading?.kundli),
      symptoms: symptoms[index]?.symptoms ?? [],
      symptomRatings: symptoms[index]?.ratings ?? {},
      note: notes.get(date)?.text ?? "",
    };
  });

  return NextResponse.json({ month, today, timezone: displayTimezone, days }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: NextRequest) {
  const user = accountUser(request);
  if (!user) return NextResponse.json({ error: "Sign in with Google to save calendar notes" }, { status: 401 });
  const body = await request.json().catch(() => null) as { date?: unknown; text?: unknown } | null;
  const date = typeof body?.date === "string" ? body.date : "";
  const text = typeof body?.text === "string" ? body.text : "";
  if (!DATE_RE.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime()) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  if (text.length > 2000) return NextResponse.json({ error: "Notes must be 2,000 characters or fewer" }, { status: 400 });
  const profile = await getBirthProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Complete your birth profile to use the calendar" }, { status: 400 });
  const note = await saveCalendarNote(user.id, date, text);
  return NextResponse.json({ note }, { headers: { "Cache-Control": "private, no-store" } });
}
