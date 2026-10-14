import { NextResponse } from "next/server";

/**
 * Digital Asset Links, served at /.well-known/assetlinks.json (see the
 * rewrite in next.config.ts): proves to Android that the Play Store app
 * (the Capacitor app, com.horospaper.app) and this site belong together,
 * so links to the site can open straight in the app.
 * ANDROID_PACKAGE_NAME is the app's package ("com.horospaper.app") and
 * ANDROID_CERT_FINGERPRINTS its signing key's SHA-256 fingerprint(s),
 * comma-separated -- shown in Play Console under App integrity > App
 * signing. Unset, this is an empty (valid) list.
 */
export function GET() {
  const packageName = process.env.ANDROID_PACKAGE_NAME?.trim();
  const fingerprints = (process.env.ANDROID_CERT_FINGERPRINTS ?? "")
    .split(",")
    .map((fingerprint) => fingerprint.trim())
    .filter(Boolean);
  const statements =
    packageName && fingerprints.length
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: fingerprints },
          },
        ]
      : [];
  return NextResponse.json(statements, { headers: { "Cache-Control": "public, max-age=3600" } });
}
