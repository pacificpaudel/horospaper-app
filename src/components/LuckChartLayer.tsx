"use client";

import { useEffect, useRef, useState } from "react";
import { getStoredGuestId } from "@/lib/client/guest";
import type { LuckChartBox } from "@/types/api";
import { KeepAwake } from "./KeepAwake";

/**
 * Makes the Luck Chart baked into a wallpaper image clickable: an invisible
 * button laid exactly over it (the image is shown with object-fit: contain
 * inside the same box as this layer), which opens LuckChartView -- just the
 * Luck Chart and its Analysis, drawn fresh to fill the whole screen.
 */
export function LuckChartLayer({ box, date, isPreview }: { box: LuckChartBox | null | undefined; date: string; isPreview: boolean }) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [open, setOpen] = useState(false);

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
            setOpen(true);
          }}
        />
      )}
      {open && <LuckChartView date={date} isPreview={isPreview} onClose={() => setOpen(false)} />}
    </div>
  );
}

function LuckChartView({ date, isPreview, onClose }: { date: string; isPreview: boolean; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    const query = new URLSearchParams({
      date,
      w: String(Math.round(window.innerWidth)),
      h: String(Math.round(window.innerHeight)),
      ...(isPreview ? { preview: "1" } : {}),
    });
    const guestId = getStoredGuestId();
    fetch(`/api/horoscope/luck-chart?${query}`, { headers: guestId ? { "x-guest-id": guestId } : {} })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(String(res.status)))))
      .then((blob) => {
        if (cancelled) return;
        // Shown through <img>, never inlined, so the SVG can't run script.
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [date, isPreview]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
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
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL, nothing for next/image to optimize
        <img src={src} alt="Today's Luck Chart and its analysis" className="luck-chart-view-image" />
      ) : failed ? (
        <p className="luck-chart-view-error">Couldn&apos;t load the Luck Chart. Tap to go back.</p>
      ) : (
        <div className="output-loader" aria-label="Loading the Luck Chart" />
      )}
    </div>
  );
}
