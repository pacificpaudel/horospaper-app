"use client";

import { useLastRefreshed } from "@/lib/client/refreshStatus";
import { formatRefreshedAt } from "@/lib/client/formatRefreshedAt";
import { APP_VERSION } from "@/lib/version";

/** "Last refreshed: Wed 14:05 · Version 6.1" -- small, on the footer's next line. */
export function FooterStatus() {
  const refreshedAt = useLastRefreshed();
  return (
    <span className="footer-status">
      {refreshedAt && <>Last refreshed: {formatRefreshedAt(refreshedAt)} · </>}
      Version {APP_VERSION}
    </span>
  );
}
