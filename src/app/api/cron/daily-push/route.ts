import { NextRequest, NextResponse } from "next/server";
import { getDevice, listDeviceUserIds, markPushSent, unregisterDevice } from "@/lib/devices";
import { ensureTodaysHoroscope } from "@/lib/deviceHoroscope";
import { isPushConfigured, sendPush } from "@/lib/fcm";

// The morning push, run every hour (see .github/workflows/daily-push.yml):
// each registered Android install whose local hour has reached its
// notification hour, and hasn't had today's push yet, gets today's Luck
// Chart and wallpaper made and a notification with the wallpaper.
// Protected by CRON_SECRET (sent as "Authorization: Bearer <secret>").

export const maxDuration = 300;
// Stop starting new devices with this much of the time limit left; the next hourly run picks up the rest.
const TIME_BUDGET_MS = 240_000;
const CONCURRENCY = 4;

const localDate = (timezone: string) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
const localHour = (timezone: string) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "numeric", hourCycle: "h23" }).format(new Date()));
const shortDate = (timezone: string) => new Intl.DateTimeFormat("en-GB", { timeZone: timezone, day: "numeric", month: "short" }).format(new Date());

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isPushConfigured()) return NextResponse.json({ error: "FIREBASE_SERVICE_ACCOUNT is not set" }, { status: 503 });

  const started = Date.now();
  const queue = await listDeviceUserIds();
  const result = { due: 0, sent: 0, removed: 0, failed: 0, deferred: 0 };

  async function handle(userId: string) {
    const device = await getDevice(userId);
    if (!device) return;
    const today = localDate(device.timezone);
    if (device.lastSentDate === today || localHour(device.timezone) < device.notifyHour) return;
    result.due++;
    try {
      const horoscope = await ensureTodaysHoroscope(userId, device.timezone);
      // No birth profile yet: nothing to make; try again next hour.
      if (!horoscope) return;
      const image = horoscope.imageUrlMobile ?? horoscope.imageUrl;
      const outcome = await sendPush(device.token, {
        title: `Your Luck Chart for ${shortDate(device.timezone)}`,
        body: horoscope.dailyReading ? `Luck ${horoscope.dailyReading.luckScore}% · Today's chart and wallpaper are ready` : "Today's chart and wallpaper are ready",
        imageUrl: image && /^https:\/\//.test(image) ? image : undefined,
        path: "/home",
      });
      if (outcome === "gone") {
        await unregisterDevice(userId);
        result.removed++;
      } else {
        await markPushSent(userId, device, today);
        result.sent++;
      }
    } catch (err) {
      console.error(`[cron/daily-push] ${userId} failed:`, err);
      result.failed++;
    }
  }

  // A few at a time, within the time budget.
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (let userId = queue.shift(); userId; userId = queue.shift()) {
      if (Date.now() - started > TIME_BUDGET_MS) {
        result.deferred += queue.length + 1;
        queue.length = 0;
        return;
      }
      await handle(userId);
    }
  });
  await Promise.all(workers);
  return NextResponse.json(result);
}
