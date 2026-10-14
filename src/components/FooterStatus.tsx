"use client";

import { useLastRefreshed } from "@/lib/client/refreshStatus";
import { formatRefreshedAt } from "@/lib/client/formatRefreshedAt";

/** "Last refreshed: Wed 14:05" -- small, on the footer's next line. (The app version is in the header, see NavBar.) */
export function FooterStatus() {
  const refreshedAt = useLastRefreshed();
  if (!refreshedAt) return null;
  return <span className="footer-status">Last refreshed: {formatRefreshedAt(refreshedAt)}</span>;
}
