import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { redis } from "@/lib/redis";

// Just enough to put one picture in one folder and make one event: the
// app can only ever touch files it created itself (drive.file), and can't
// read the calendar's existing events (calendar.events covers writes to
// events it is given).
const SCOPES = ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/calendar.events"];

// The refresh token outlives the app's own 24h data: reconnecting Google
// on every visit would be the worst part of the feature.
const TOKEN_TTL_SECONDS = 180 * 24 * 60 * 60;
// A consent round-trip, not a session.
const STATE_TTL_SECONDS = 10 * 60;

const tokenKey = (userId: string) => `google:tokens:${userId}`;
const stateKey = (state: string) => `google:oauth-state:${state}`;

interface StoredTokens {
  refreshToken: string;
  accessToken: string;
  /** Epoch ms; refreshed a minute early so a slow request doesn't race it. */
  expiresAt: number;
}

/** What the consent round-trip has to remember to finish the event it was asked for. */
export interface PendingEvent {
  userId: string;
  date: string;
  topic: string;
  symptoms: string[];
  w: number;
  h: number;
  preview: boolean;
}

export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

/**
 * Where Google sends the browser back. Must match a redirect URI listed on
 * the OAuth client; set GOOGLE_OAUTH_REDIRECT_URI when the public origin
 * isn't what this request arrived on.
 */
export function googleRedirectUri(request: NextRequest): string {
  const configured = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (configured) return configured;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}/api/google/callback`;
}

/**
 * The consent URL for an event the user has already filled in: the event
 * itself is made by the callback, so connecting Google and getting the
 * event are one trip rather than two.
 */
export async function googleConsentUrl(request: NextRequest, pending: PendingEvent): Promise<string> {
  const state = randomUUID();
  await redis.set(stateKey(state), pending, { ex: STATE_TTL_SECONDS });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(request),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    // Without this a returning user is sent back with no refresh token.
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/** Reads and retires a consent state -- one callback per consent URL. */
export async function takePendingEvent(state: string): Promise<PendingEvent | null> {
  if (!state) return null;
  return (await redis.getdel<PendingEvent>(stateKey(state))) ?? null;
}

async function tokenRequest(body: Record<string, string>): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "", ...body }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Google token request failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Trades the callback's code for tokens and stores them for this guest. */
export async function completeGoogleConsent(code: string, redirectUri: string, userId: string): Promise<string> {
  const token = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  if (!token.refresh_token) throw new Error("Google didn't return a refresh token");
  const tokens: StoredTokens = { refreshToken: token.refresh_token, accessToken: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
  await redis.set(tokenKey(userId), tokens, { ex: TOKEN_TTL_SECONDS });
  return token.access_token;
}

/**
 * A usable access token for a guest who has connected Google before, or
 * null if they haven't (or their consent has been revoked) -- in which
 * case the caller sends them back through googleConsentUrl.
 */
export async function googleAccessToken(userId: string): Promise<string | null> {
  const stored = await redis.get<StoredTokens>(tokenKey(userId));
  if (!stored?.refreshToken) return null;
  if (stored.accessToken && stored.expiresAt > Date.now() + 60_000) return stored.accessToken;
  try {
    const token = await tokenRequest({ refresh_token: stored.refreshToken, grant_type: "refresh_token" });
    const refreshed: StoredTokens = { ...stored, accessToken: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
    await redis.set(tokenKey(userId), refreshed, { ex: TOKEN_TTL_SECONDS });
    return token.access_token;
  } catch (err) {
    // Revoked or expired consent: drop it so the next try asks again.
    console.warn("[google] refresh failed, dropping stored consent:", err instanceof Error ? err.message : err);
    await redis.del(tokenKey(userId));
    return null;
  }
}
