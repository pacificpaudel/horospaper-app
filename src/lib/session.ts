import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

export const GUEST_HEADER = "x-guest-id";

export interface CurrentUser {
  id: string;
  email?: string;
  name?: string;
}

const SESSION_COOKIE = "horospaper_google_session";
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

interface SessionPayload {
  sub: string;
  email: string;
  name: string;
  exp: number;
}

function sessionSecret(): string {
  return process.env.AUTH_SESSION_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";
}

function signature(value: string): Buffer {
  return createHmac("sha256", sessionSecret()).update(value).digest();
}

export function createSessionToken(user: Omit<SessionPayload, "exp">): string {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS })).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}

function readSession(request: NextRequest): SessionPayload | null {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const [payload, encodedSignature] = token?.split(".") ?? [];
  if (!payload || !encodedSignature || !sessionSecret()) return null;
  try {
    const received = Buffer.from(encodedSignature, "base64url");
    const expected = signature(payload);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (typeof session.sub !== "string" || !session.sub.startsWith("google:") || session.exp <= Date.now() / 1000) return null;
    return session;
  } catch {
    return null;
  }
}

export function setSessionCookie(response: import("next/server").NextResponse, user: Omit<SessionPayload, "exp">): void {
  response.cookies.set(SESSION_COOKIE, createSessionToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(response: import("next/server").NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

/**
 * Every visitor is an anonymous guest identified by a client-generated id
 * (see src/lib/client/guest.ts). There's no account system or persistent
 * user store -- the id is just a namespace for that browser's 24h data.
 */
export function getCurrentUser(request: NextRequest): CurrentUser | null {
  const session = readSession(request);
  if (session) return { id: session.sub, email: session.email, name: session.name };
  const guestId = request.headers.get(GUEST_HEADER);
  if (!guestId) return null;
  return { id: guestId };
}
