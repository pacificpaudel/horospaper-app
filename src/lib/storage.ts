import fs from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

const LOCAL_DIR = path.join(process.cwd(), "public", "generated");

export interface StoredFile {
  url: string; // public URL to serve the file
}

async function saveLocal(filename: string, data: Buffer | string, contentType: string): Promise<StoredFile> {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  const filePath = path.join(LOCAL_DIR, filename);
  await fs.writeFile(filePath, data);
  void contentType; // local static serving infers content-type from extension
  return { url: `/generated/${filename}` };
}

async function saveToBlob(filename: string, data: Buffer | string, contentType: string): Promise<StoredFile> {
  const blob = await put(filename, data, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return { url: blob.url };
}

/**
 * Saves a generated file (SVG or PNG/JPG) and returns its public URL.
 * "local" writes under /public/generated -- only works where the
 * filesystem is writable (local dev, Docker). Vercel's serverless
 * functions have a read-only filesystem, so production uses
 * "vercel-blob" instead.
 */
export async function saveGeneratedFile(
  filename: string,
  data: Buffer | string,
  contentType: string
): Promise<StoredFile> {
  const provider = process.env.STORAGE_PROVIDER || "local";

  if (provider === "vercel-blob") {
    return saveToBlob(filename, data, contentType);
  }
  if (provider === "local") {
    return saveLocal(filename, data, contentType);
  }

  throw new Error(`STORAGE_PROVIDER="${provider}" is not implemented. Use "local" or "vercel-blob".`);
}

/** Reads back a file saved by saveGeneratedFile, from the URL it returned. */
export async function readGeneratedFile(url: string): Promise<Buffer> {
  if (url.startsWith("/generated/")) {
    return fs.readFile(path.join(LOCAL_DIR, path.basename(url)));
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Couldn't read generated file (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Best-effort removal of superseded files (e.g. last hour's wallpaper once
 * the hourly refresh has replaced it), so they don't pile up all day.
 */
export async function deleteGeneratedFiles(urls: string[]): Promise<void> {
  const local = urls.filter((url) => url.startsWith("/generated/"));
  const remote = urls.filter((url) => !url.startsWith("/generated/"));
  await Promise.allSettled(local.map((url) => fs.unlink(path.join(LOCAL_DIR, path.basename(url)))));
  if (remote.length) {
    try {
      await del(remote);
    } catch (err) {
      console.warn("[storage] couldn't delete superseded files:", err instanceof Error ? err.message : err);
    }
  }
}
