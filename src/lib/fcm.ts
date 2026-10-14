import { createSign } from "node:crypto";

// Sends push notifications to the Android app through Firebase Cloud
// Messaging (the HTTP v1 API), signed in with a Firebase service account:
// FIREBASE_SERVICE_ACCOUNT holds its JSON key file's contents (as-is, or
// base64-encoded), from Firebase console > Project settings > Service
// accounts > Generate new private key.

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

let cachedAccount: ServiceAccount | null | undefined;
let cachedToken: { value: string; expiresAt: number } | null = null;

function serviceAccount(): ServiceAccount | null {
  if (cachedAccount !== undefined) return cachedAccount;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (!raw) return (cachedAccount = null);
  const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const parsed = JSON.parse(json) as ServiceAccount;
  return (cachedAccount = parsed.project_id && parsed.client_email && parsed.private_key ? parsed : null);
}

export const isPushConfigured = () => serviceAccount() !== null;

const base64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

/** An OAuth access token for FCM, from a JWT signed with the service account's key (cached until shortly before it expires). */
async function accessToken(account: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(account.private_key);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claims}.${base64url(signature)}` }),
  });
  if (!response.ok) throw new Error(`Firebase sign-in failed (${response.status})`);
  const { access_token, expires_in } = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: access_token, expiresAt: Date.now() + expires_in * 1000 };
  return access_token;
}

export interface PushMessage {
  title: string;
  body: string;
  /** A public https image shown in the expanded notification. */
  imageUrl?: string;
  /** Where in the app a tap opens (a path on the site). */
  path?: string;
}

/** "sent", or "gone" when Firebase says the token is dead (the app was uninstalled) -- the caller should forget it. */
export async function sendPush(token: string, message: PushMessage): Promise<"sent" | "gone"> {
  const account = serviceAccount();
  if (!account) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken(account)}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: message.title, body: message.body, ...(message.imageUrl ? { image: message.imageUrl } : {}) },
        data: { path: message.path ?? "/home" },
        android: { priority: "high", notification: { channel_id: "daily", icon: "ic_stat_horospaper", color: "#f7c56a" } },
      },
    }),
  });
  if (response.ok) return "sent";
  const detail = await response.text();
  if (response.status === 404 || detail.includes("UNREGISTERED")) return "gone";
  throw new Error(`Push failed (${response.status}): ${detail.slice(0, 300)}`);
}
