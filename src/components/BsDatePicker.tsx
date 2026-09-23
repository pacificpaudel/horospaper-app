"use client";

import { useEffect, useRef, useState } from "react";
import { BS_MAX_YEAR, BS_MIN_YEAR, BS_MONTHS, bsMonthLength, bsToday, bsWeekday, formatBs } from "@/lib/nepaliDate";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const YEARS = Array.from({ length: BS_MAX_YEAR - BS_MIN_YEAR + 1 }, (_, i) => BS_MAX_YEAR - i);

function parseBs(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  if (year < BS_MIN_YEAR || year > BS_MAX_YEAR) return null;
  return { year, month: Number(m[2]), day: Number(m[3]) };
}

/**
 * Calendar-icon button + month-grid popover for picking a Bikram Sambat
 * date -- the BS counterpart of the native AD date picker, which browsers
 * can't show in BS. Emits "YYYY-MM-DD" (BS) via `onSelect`.
 */
export function BsDatePicker({ value, onSelect }: { value: string; onSelect: (bs: string) => void }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<{ year: number; month: number }>({ year: 2050, month: 1 });
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = parseBs(value);

  function toggle() {
    if (!open) {
      // Open on the selected month, else the current one (today in BS).
      const start = selected ?? parseBs(bsToday() ?? "");
      if (start) setView({ year: start.year, month: start.month });
    }
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function shiftMonth(delta: number) {
    setView(({ year, month }) => {
      let m = month + delta;
      let y = year;
      if (m < 1) { m = 12; y -= 1; }
      if (m > 12) { m = 1; y += 1; }
      if (y < BS_MIN_YEAR || y > BS_MAX_YEAR) return { year, month };
      return { year: y, month: m };
    });
  }

  const days = bsMonthLength(view.year, view.month);
  const firstWeekday = bsWeekday(view.year, view.month, 1) ?? 0;
  const atStart = view.year === BS_MIN_YEAR && view.month === 1;
  const atEnd = view.year === BS_MAX_YEAR && view.month === 12;

  return (
    <div ref={rootRef} className="bs-picker">
      <button
        type="button"
        className="bs-picker-toggle"
        aria-label="Choose date of birth from a BS calendar"
        aria-expanded={open}
        onClick={toggle}
      >
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="2" y="3" width="12" height="11" rx="1.5" />
          <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="bs-picker-panel" role="dialog" aria-label="Bikram Sambat calendar">
          <div className="bs-picker-head">
            <button type="button" className="bs-picker-nav" onClick={() => shiftMonth(-1)} disabled={atStart} aria-label="Previous month">‹</button>
            <select
              value={view.month}
              onChange={(e) => setView((v) => ({ ...v, month: Number(e.target.value) }))}
              aria-label="Month"
              className="bs-picker-select"
            >
              {BS_MONTHS.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
            </select>
            <select
              value={view.year}
              onChange={(e) => setView((v) => ({ ...v, year: Number(e.target.value) }))}
              aria-label="Year"
              className="bs-picker-select"
            >
              {YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
            <button type="button" className="bs-picker-nav" onClick={() => shiftMonth(1)} disabled={atEnd} aria-label="Next month">›</button>
          </div>

          <div className="bs-picker-grid">
            {WEEKDAYS.map((d) => <span key={d} className="bs-picker-weekday">{d}</span>)}
            {Array.from({ length: firstWeekday }, (_, i) => <span key={`pad-${i}`} />)}
            {Array.from({ length: days }, (_, i) => {
              const day = i + 1;
              const isSelected = selected?.year === view.year && selected.month === view.month && selected.day === day;
              return (
                <button
                  key={day}
                  type="button"
                  className="bs-picker-day"
                  aria-pressed={isSelected}
                  aria-label={`${day} ${BS_MONTHS[view.month - 1]} ${view.year}`}
                  onClick={() => {
                    onSelect(formatBs(view.year, view.month, day));
                    setOpen(false);
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
