"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "./Logo";

export function NavBar({ downloadUrl, onFrame }: { downloadUrl?: string | null; onFrame?: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <nav className="mx-auto flex min-h-20 max-w-6xl items-center justify-between px-5 py-3 md:px-8">
        <Link href="/home">
          <Logo />
        </Link>
        {downloadUrl ? (
          <div className="flex items-center gap-2">
            {onFrame && <FrameButton onClick={onFrame} />}
            <DownloadButton href={downloadUrl} />
          </div>
        ) : (
          <span className="text-xs uppercase tracking-[0.2em] text-muted">Daily sky notes</span>
        )}
      </nav>
    </header>
  );
}

function DownloadButton({ href }: { href: string }) {
  const [busy, setBusy] = useState(false);

  // A plain <a download> only forces a save for same-origin links -- this
  // image is served from Vercel Blob storage, a different origin, so the
  // browser would just navigate to it (opening the image in place of the
  // app, or in a new tab) instead of saving it. Fetching it into a blob and
  // downloading that gives a real one-click save on any origin.
  async function handleDownload() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const extension = href.split(".").pop()?.split(/[?#]/)[0] || "jpg";
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `horospaper-reading.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(href, "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={busy}
      aria-label="Download today's horospaper artwork"
      className="download-button"
    >
      <span aria-hidden="true">↓</span>
      <span className="hidden sm:inline">{busy ? "Downloading…" : "Download"}</span>
    </button>
  );
}

function FrameButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Use as frame" className="download-button">
      <svg aria-hidden="true" viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M7 3H4a1 1 0 0 0-1 1v3" />
        <path d="M13 3h3a1 1 0 0 1 1 1v3" />
        <path d="M7 17H4a1 1 0 0 1-1-1v-3" />
        <path d="M13 17h3a1 1 0 0 0 1-1v-3" />
      </svg>
      <span className="hidden sm:inline">Use as Frame</span>
    </button>
  );
}
