"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ensureGuestId } from "./guest";

/**
 * Ensures the current visitor has *some* identity (a signed-in session or
 * a lazily-created guest id) before protected API calls are made. Returns
 * `ready: true` once it's safe to call the API.
 */
export function useIdentity() {
  const { status } = useSession();
  const [guestReady, setGuestReady] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      ensureGuestId().then(() => setGuestReady(true));
    }
  }, [status]);

  const ready = status === "authenticated" || (status === "unauthenticated" && guestReady);

  return {
    status,
    ready,
    isGuest: status !== "authenticated",
  };
}
