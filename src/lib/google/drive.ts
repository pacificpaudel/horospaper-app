import { randomUUID } from "node:crypto";

const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";

/** The one folder this app keeps in the user's Drive. */
export const EVENTS_FOLDER = "Horosevents";

export interface DriveFile {
  id: string;
  /** The page a calendar attachment opens -- what Drive calls webViewLink. */
  webViewLink: string;
}

async function driveJson<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.body && !(init.headers as Record<string, string>)?.["Content-Type"] ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Drive request failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

/**
 * The "Horosevents" folder, made on first use. With the drive.file scope
 * the search only ever sees folders this app created itself, so it finds
 * the one it made before and never an unrelated folder of the same name.
 */
export async function ensureEventsFolder(token: string): Promise<string> {
  const query = `name = '${EVENTS_FOLDER}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const found = await driveJson<{ files?: { id: string }[] }>(token, `${DRIVE}/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`);
  const existing = found.files?.[0]?.id;
  if (existing) return existing;
  const created = await driveJson<{ id: string }>(token, `${DRIVE}/files?fields=id`, {
    method: "POST",
    body: JSON.stringify({ name: EVENTS_FOLDER, mimeType: FOLDER_MIME }),
  });
  return created.id;
}

/** Uploads a PNG into a folder in one multipart request (metadata + bytes). */
export async function uploadPngToFolder(token: string, folderId: string, filename: string, png: Buffer): Promise<DriveFile> {
  const boundary = `horospaper-${randomUUID()}`;
  const metadata = JSON.stringify({ name: filename, parents: [folderId], mimeType: "image/png" });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: image/png\r\n\r\n`),
    png,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const res = await fetch(`${UPLOAD}?uploadType=multipart&fields=id,webViewLink`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Drive upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<DriveFile>;
}

/**
 * Anyone with the link can view the file -- an event's guests see the
 * attachment, not a request-access page. The file stays unlisted and
 * unsearchable; only the link reaches it.
 */
export async function shareWithAnyone(token: string, fileId: string): Promise<void> {
  await driveJson(token, `${DRIVE}/files/${fileId}/permissions?fields=id`, {
    method: "POST",
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
}
