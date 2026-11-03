const CALENDAR = "https://www.googleapis.com/calendar/v3";

export interface AllDayEvent {
  summary: string;
  description: string;
  /** YYYY-MM-DD; the event covers this one day. */
  date: string;
  attachment: { fileUrl: string; title: string };
}

/** The day after `date`, which is where an all-day Google event ends. */
function dayAfter(date: string): string {
  const end = new Date(`${date}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return end.toISOString().slice(0, 10);
}

/**
 * Creates an all-day event on the user's primary calendar with a Drive
 * file attached. Attachments only exist through the API (the event
 * template URL has no way to carry one) and only with
 * supportsAttachments, and their fileUrl has to be a Drive link.
 */
export async function insertAllDayEvent(token: string, event: AllDayEvent): Promise<{ htmlLink: string }> {
  const res = await fetch(`${CALENDAR}/calendars/primary/events?supportsAttachments=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: event.summary,
      description: event.description,
      start: { date: event.date },
      end: { date: dayAfter(event.date) },
      attachments: [{ fileUrl: event.attachment.fileUrl, title: event.attachment.title, mimeType: "image/png" }],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Calendar insert failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<{ htmlLink: string }>;
}
