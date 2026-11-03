import { createHash } from "node:crypto";
import { renderLuckChartPng } from "@/lib/image/luckChartShot";
import { deleteGeneratedFiles, saveGeneratedFile } from "@/lib/storage";
import { insertAllDayEvent } from "./calendar";
import { EVENTS_FOLDER, ensureEventsFolder, shareWithAnyone, uploadPngToFolder } from "./drive";
import type { PendingEvent } from "./oauth";

/** The day had no Luck Chart to photograph -- nothing to make an event from. */
export class NoLuckChartError extends Error {}

export type EventResult =
  /** The event exists, with the Drive copy attached to it. */
  | { kind: "created"; eventUrl: string; fileUrl: string }
  /**
   * No Google connection (or Drive/Calendar wouldn't play): the screenshot
   * is still stored and `templateUrl` opens a pre-filled event with its
   * link in the description, so the picture always travels with the event.
   */
  | { kind: "template"; templateUrl: string; imageUrl: string };

/** Google's pre-filled "new event" page: all this can carry is text, so the picture goes in as a link. */
function eventTemplateUrl(topic: string, date: string, imageUrl: string): string {
  const compact = (iso: string) => iso.replace(/-/g, "");
  const end = new Date(`${date}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: topic,
    dates: `${compact(date)}/${compact(end.toISOString().slice(0, 10))}`,
    details: `Luck Chart for ${date}\n\nScreenshot:\n${imageUrl}`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

/** Stores the rendered chart and returns its absolute URL. */
async function storeShot(pending: PendingEvent, png: Buffer, origin: string): Promise<{ url: string; stored: string }> {
  const token = createHash("sha256").update(`${pending.userId}:${pending.date}`).digest("hex").slice(0, 32);
  const { url } = await saveGeneratedFile(`luck-chart-${token}.png`, png, "image/png");
  return { url: url.startsWith("/") ? `${origin}${url}` : url, stored: url };
}

/**
 * The whole job behind the Luck Chart's calendar icon: draw the day's
 * chart, keep a copy in the user's Drive (in Horosevents), and make an
 * all-day event for that day with the Drive copy attached.
 *
 * The screenshot is written to this app's own storage first and copied
 * from there into Drive, then deleted once Drive has it -- the event
 * points only at the Drive file, which survives any cleanup of generated
 * files. If Drive or Calendar refuses, that stored copy is kept and the
 * caller gets a pre-filled event URL linking it instead, so the user is
 * never handed an event without its screenshot.
 */
export async function createLuckChartEvent(token: string | null, pending: PendingEvent, origin: string): Promise<EventResult> {
  const png = await renderLuckChartPng(pending.userId, pending.date, pending.w, pending.h, pending.preview);
  if (!png) throw new NoLuckChartError(`No Luck Chart for ${pending.date}`);
  const shot = await storeShot(pending, png, origin);

  if (!token) return { kind: "template", templateUrl: eventTemplateUrl(pending.topic, pending.date, shot.url), imageUrl: shot.url };

  try {
    const folderId = await ensureEventsFolder(token);
    const file = await uploadPngToFolder(token, folderId, `luck-chart-${pending.date}.png`, png);
    await shareWithAnyone(token, file.id);
    const event = await insertAllDayEvent(token, {
      summary: pending.topic,
      description: `Luck Chart for ${pending.date}\n\nScreenshot (attached, and in your Drive under ${EVENTS_FOLDER}):\n${file.webViewLink}`,
      date: pending.date,
      attachment: { fileUrl: file.webViewLink, title: `Luck Chart ${pending.date}` },
    });
    // Drive holds the screenshot now; this app's copy was only the source.
    await deleteGeneratedFiles([shot.stored]);
    return { kind: "created", eventUrl: event.htmlLink, fileUrl: file.webViewLink };
  } catch (err) {
    console.warn("[google] Drive/Calendar failed, falling back to a pre-filled event:", err instanceof Error ? err.message : err);
    return { kind: "template", templateUrl: eventTemplateUrl(pending.topic, pending.date, shot.url), imageUrl: shot.url };
  }
}
