import { NextRequest } from "next/server";

export const GUEST_HEADER = "x-guest-id";

export interface CurrentUser {
  id: string;
}

/**
 * Every visitor is an anonymous guest identified by a client-generated id
 * (see src/lib/client/guest.ts). There's no account system or persistent
 * user store -- the id is just a namespace for that browser's 24h data.
 */
export function getCurrentUser(request: NextRequest): CurrentUser | null {
  const guestId = request.headers.get(GUEST_HEADER);
  if (!guestId) return null;
  return { id: guestId };
}
