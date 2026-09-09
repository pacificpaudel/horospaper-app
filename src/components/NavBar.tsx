"use client";

import Link from "next/link";
import { Logo } from "./Logo";

export function NavBar({ downloadUrl }: { downloadUrl?: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <nav className="mx-auto flex min-h-20 max-w-6xl items-center justify-between px-5 py-3 md:px-8">
        <Link href="/home">
          <Logo />
        </Link>
        {downloadUrl ? <DownloadButton href={downloadUrl} /> : <span className="text-xs uppercase tracking-[0.2em] text-muted">Daily sky notes</span>}
      </nav>
    </header>
  );
}

function DownloadButton({ href }: { href: string }) {
  return (
    <a href={href} download="horospaper-reading" aria-label="Download today's horospaper artwork" className="download-button">
      <span aria-hidden="true">↓</span>
      <span className="hidden sm:inline">Download</span>
    </a>
  );
}
