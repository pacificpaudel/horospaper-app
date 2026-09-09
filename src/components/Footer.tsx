import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-border/70 bg-background/55">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-col items-center justify-between gap-2 px-5 py-2 text-center text-xs text-muted sm:flex-row sm:px-8 sm:text-left">
        <Logo className="scale-75 origin-left opacity-80" />
        <span>Made for reflection, not prediction.</span>
        <span>horospaper · Vedic daily notes</span>
      </div>
    </footer>
  );
}