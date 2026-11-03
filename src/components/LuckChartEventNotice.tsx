"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Why the Google consent round-trip came back here instead of landing on
// the new event (/api/google/callback redirects with one of these).
const MESSAGES: Record<string, string> = {
  declined: "Google wasn't connected, so no calendar event was made.",
  expired: "That calendar request went stale before Google came back. Open the Luck Chart and try again.",
  failed: "Couldn't finish the calendar event. Open the Luck Chart and try again.",
};

/**
 * The one-line reason a Luck Chart calendar event didn't happen, read
 * straight from the URL at render time (never set into state from an
 * effect) and cleared by dismissing it. Wrap in <Suspense>: reading the
 * query string opts this subtree out of prerendering.
 */
export function LuckChartEventNotice() {
  const params = useSearchParams();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const message = MESSAGES[params.get("luckChartEvent") ?? ""];
  if (!message || dismissed) return null;

  return (
    <p className="luck-chart-event-notice" role="status">
      {message}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          setDismissed(true);
          router.replace("/home");
        }}
      >
        ×
      </button>
    </p>
  );
}
