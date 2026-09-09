import fs from "node:fs/promises";
import path from "node:path";

const GENERATED_DIR = path.join(process.cwd(), "public", "generated");

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  const safeFilename = path.basename(filename);
  if (safeFilename !== filename) return new Response("Not found", { status: 404 });

  try {
    const data = await fs.readFile(path.join(GENERATED_DIR, safeFilename));
    const contentType = safeFilename.endsWith(".png")
      ? "image/png"
      : safeFilename.endsWith(".webp")
        ? "image/webp"
        : safeFilename.endsWith(".jpg") || safeFilename.endsWith(".jpeg")
          ? "image/jpeg"
          : "image/svg+xml";
    return new Response(data, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": contentType,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
