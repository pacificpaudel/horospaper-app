import fs from "node:fs/promises";
import path from "node:path";

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

/**
 * Saves a generated file (SVG or PNG) and returns its public URL.
 * "local" stores under /public/generated and is served directly by
 * Next.js -- swap STORAGE_PROVIDER=s3 and implement the S3 branch below
 * to point at real object storage in production.
 */
export async function saveGeneratedFile(
  filename: string,
  data: Buffer | string,
  contentType: string
): Promise<StoredFile> {
  const provider = process.env.STORAGE_PROVIDER || "local";

  if (provider === "local") {
    return saveLocal(filename, data, contentType);
  }

  throw new Error(
    `STORAGE_PROVIDER="${provider}" is not implemented in this MVP. Set STORAGE_PROVIDER=local, ` +
      "or implement the S3-compatible upload here using S3_ENDPOINT/S3_BUCKET/S3_* env vars."
  );
}
