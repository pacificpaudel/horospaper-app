"use client";

import { useEffect, useRef, useState } from "react";
import { getStoredGuestId } from "@/lib/client/guest";
import type { LuckChartBox } from "@/types/api";
import type { LuckChartInfo } from "@/lib/image/gocharOverlay";
import { KeepAwake } from "./KeepAwake";

/**
 * Makes the Luck Chart baked into a wallpaper image clickable: an invisible
 * button laid exactly over it (the image is shown with object-fit: contain
 * inside the same box as this layer), which opens LuckChartView -- just the
 * Luck Chart and its Analysis, drawn fresh to fill the whole screen.
 * Whether it's open is owned by the page, so the zoomed view survives the
 * wallpaper being swapped (and this layer remounted) at a new day and just
 * redraws for the new date.
 */
export function LuckChartLayer({
  box,
  date,
  isPreview,
  open,
  onOpenChange,
}: {
  box: LuckChartBox | null | undefined;
  date: string;
  isPreview: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  let hotspot: React.CSSProperties | null = null;
  if (box && size && size.w > 0 && size.h > 0) {
    // Where object-fit: contain puts the image inside this layer's box.
    const scale = Math.min(size.w / box.canvasW, size.h / box.canvasH);
    const offsetX = (size.w - box.canvasW * scale) / 2;
    const offsetY = (size.h - box.canvasH * scale) / 2;
    hotspot = { left: offsetX + box.x * scale, top: offsetY + box.y * scale, width: box.w * scale, height: box.h * scale };
  }

  return (
    <div ref={layerRef} className="luck-chart-layer">
      {hotspot && (
        <button
          type="button"
          className="luck-chart-hotspot"
          style={hotspot}
          aria-label="Open the Luck Chart full screen"
          title="Open the Luck Chart full screen"
          onClick={(e) => {
            // Frame mode exits on any click that reaches its own container.
            e.stopPropagation();
            onOpenChange(true);
          }}
        />
      )}
      {open && <LuckChartView date={date} isPreview={isPreview} onClose={() => onOpenChange(false)} />}
    </div>
  );
}

/** The drawn chart: its blob URL, the size it was drawn for, and what its Analysis "i" opens. */
interface ChartImage {
  src: string;
  w: number;
  h: number;
  info: LuckChartInfo | null;
}

function readInfo(res: Response): LuckChartInfo | null {
  const header = res.headers.get("X-Luck-Chart-Info");
  if (!header) return null;
  try {
    return JSON.parse(decodeURIComponent(header)) as LuckChartInfo;
  } catch {
    return null;
  }
}

function LuckChartView({ date, isPreview, onClose }: { date: string; isPreview: boolean; onClose: () => void }) {
  const [chart, setChart] = useState<ChartImage | null>(null);
  const [failed, setFailed] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [viewSize, setViewSize] = useState<{ w: number; h: number } | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const measure = () => setViewSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Revoked only when the view closes -- a new day's chart replaces it below.
  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    },
    [],
  );

  // Redrawn whenever `date` changes (the page swapped in a new day's
  // horoscope), keeping the previous chart on screen until the new one is in.
  useEffect(() => {
    let cancelled = false;
    const w = Math.round(window.innerWidth);
    const h = Math.round(window.innerHeight);
    const query = new URLSearchParams({ date, w: String(w), h: String(h), ...(isPreview ? { preview: "1" } : {}) });
    const guestId = getStoredGuestId();
    fetch(`/api/horoscope/luck-chart?${query}`, { headers: guestId ? { "x-guest-id": guestId } : {} })
      .then((res) => (res.ok ? res.blob().then((blob) => ({ blob, info: readInfo(res) })) : Promise.reject(new Error(String(res.status)))))
      .then(({ blob, info }) => {
        if (cancelled) return;
        // Shown through <img>, never inlined, so the SVG can't run script.
        const previous = objectUrlRef.current;
        objectUrlRef.current = URL.createObjectURL(blob);
        setChart({ src: objectUrlRef.current, w, h, info });
        setFailed(false);
        if (previous) URL.revokeObjectURL(previous);
      })
      .catch(() => {
        // A failed redraw keeps the previous day's chart up rather than an error.
        if (!cancelled && !objectUrlRef.current) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [date, isPreview]);

  useEffect(() => {
    // Escape closes the Agreement & Conflict details first, then the view.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (infoOpen) setInfoOpen(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, infoOpen]);

  // The drawn "i", mapped from the SVG's pixels to where object-fit:
  // contain shows the image in this view.
  let infoHotspot: React.CSSProperties | null = null;
  if (chart?.info && viewSize && viewSize.w > 0 && viewSize.h > 0) {
    const scale = Math.min(viewSize.w / chart.w, viewSize.h / chart.h);
    const { cx, cy, r } = chart.info.button;
    const hit = r * 1.4 * scale; // a little larger than the circle, for fingers
    infoHotspot = {
      left: (viewSize.w - chart.w * scale) / 2 + cx * scale - hit,
      top: (viewSize.h - chart.h * scale) / 2 + cy * scale - hit,
      width: hit * 2,
      height: hit * 2,
    };
  }

  return (
    <div
      ref={viewRef}
      className="luck-chart-view"
      role="dialog"
      aria-modal="true"
      aria-label="Luck Chart"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      {/* Left open on a frame, this view would otherwise time out to the screensaver. */}
      <KeepAwake />
      {chart ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL, nothing for next/image to optimize
        <img src={chart.src} alt="Today's Luck Chart and its analysis" className="luck-chart-view-image" />
      ) : failed ? (
        <p className="luck-chart-view-error">Couldn&apos;t load the Luck Chart. Tap to go back.</p>
      ) : (
        <div className="output-loader" aria-label="Loading the Luck Chart" />
      )}
      {infoHotspot && (
        <button
          type="button"
          className="luck-chart-info-hotspot"
          style={infoHotspot}
          aria-label="Agreement and conflict between the grahas' readings"
          title="Agreement & conflict"
          onClick={(e) => {
            e.stopPropagation();
            setInfoOpen(true);
          }}
        />
      )}
      {infoOpen && chart?.info && (
        <div
          className="luck-chart-info-backdrop"
          onClick={(e) => {
            // Tapping outside the card closes only the card, not the view.
            e.stopPropagation();
            setInfoOpen(false);
          }}
        >
          <section className="luck-chart-info" role="dialog" aria-label="Agreement and conflict" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="luck-chart-info-close" aria-label="Close" onClick={() => setInfoOpen(false)}>
              ×
            </button>
            <h2 lang="ne">
              {chart.info.title.ne} <span lang="en">/ {chart.info.title.en}</span>
            </h2>
            {chart.info.lines.length ? (
              <ul>
                {chart.info.lines.map((line) => (
                  <li key={line.en} style={{ color: line.color }}>
                    <span lang="ne">{line.ne}</span> / {line.en}: {line.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p>NO TWO GRAHAS SPEAK TO THE SAME AREA TODAY.</p>
            )}
            <p className="luck-chart-info-rule">{chart.info.rule}</p>
          </section>
        </div>
      )}
    </div>
  );
}
