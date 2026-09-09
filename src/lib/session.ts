import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const GUEST_HEADER = "x-guest-id";

export interface CurrentUser {
  id: string;
  isGuest: boolean;
  role: string;
  disabled: boolean;
}

/**
 * Resolves the current user for an API request: a signed-in NextAuth
 * session takes priority; otherwise falls back to the guest id sent by
 * the client (created via /api/guest). Returns null if neither applies.
 */
export async function getCurrentUser(request: NextRequest): Promise<CurrentUser | null> {
  const session = await auth();
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return null;
    return { id: user.id, isGuest: false, role: user.role, disabled: user.disabled };
  }

  const guestId = request.headers.get(GUEST_HEADER);
  if (guestId) {
    const user = await prisma.user.findUnique({ where: { id: guestId } });
    if (user && user.isGuest) {
      return { id: user.id, isGuest: true, role: user.role, disabled: user.disabled };
    }
  }

  return null;
}
