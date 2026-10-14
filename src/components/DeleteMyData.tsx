"use client";

import { useState } from "react";
import { clearGuestId, getStoredGuestId } from "@/lib/client/guest";

/**
 * "Delete my data": removes everything the server keeps for this device
 * (birth details, readings, the Android app's push registration -- see
 * DELETE /api/device) and forgets the device's guest id.
 */
export function DeleteMyData() {
  const [state, setState] = useState<"idle" | "working" | "done" | "failed">("idle");

  async function remove() {
    const guestId = getStoredGuestId();
    if (!guestId) return setState("done");
    setState("working");
    try {
      const response = await fetch("/api/device", { method: "DELETE", headers: { "x-guest-id": guestId } });
      if (!response.ok) throw new Error(String(response.status));
      clearGuestId();
      setState("done");
    } catch {
      setState("failed");
    }
  }

  if (state === "done") return <p className="privacy-delete-done">Done — everything we kept for this device has been deleted.</p>;
  return (
    <p>
      <button type="button" className="privacy-delete" onClick={remove} disabled={state === "working"}>
        {state === "working" ? "Deleting…" : "Delete my data now"}
      </button>
      {state === "failed" && <span className="privacy-delete-error"> Couldn&apos;t delete just now — please try again.</span>}
    </p>
  );
}
