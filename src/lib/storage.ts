import fs from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

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
