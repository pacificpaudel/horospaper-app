"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { apiFetch, ApiError } from "@/lib/client/api";
import { PHYSICAL_SYMPTOMS, type PhysicalSymptomId, type PhysicalSymptomRatings } from "@/lib/physicalSymptoms";
import { adToBs } from "@/lib/nepaliDate";

interface CalendarDay {
  date: string;
  luckScore: number;
  isEstimate: boolean;
  moonPhase: string;
  moonIllumination: number;
  panchang: null | { tithi: { name: string; paksha: string }; nakshatra: { name: string }; yoga: { name: string } };
  auspiciousSummary: string | null;
  suitableActivities: string[];
  luckChartAvailable: boolean;
  symptoms: PhysicalSymptomId[];
  symptomRatings: PhysicalSymptomRatings;
  note: string;
}

interface MonthResponse {
  month: string;
  today: string;
  timezone: string;
  days: CalendarDay[];
}

const pad = (value: number) => String(value).padStart(2, "0");
const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
};
const moveMonth = (month: string, delta: number) => {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
};
const monthTitle = (month: string) => new Date(`${month}-01T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
function MoonPhaseImage({ illumination, phase, date }: { illumination: number; phase: string; date: string }) {
  const radius = 10;
  const offset = radius * 2 * Math.max(0, Math.min(100, illumination)) / 100;
  const waxing = /waxing|new moon/i.test(phase);
  const shadowX = 12 + (waxing ? -offset : offset);
  return (
    <svg className="calendar-moon-image" viewBox="0 0 24 24" role="img" aria-label={`${phase} moon on ${date}`}>
      <title>{phase}</title>
      <circle cx="12" cy="12" r={radius} fill="#f4edcf" />
      <circle cx={shadowX} cy="12" r={radius} fill="#34364a" />
    </svg>
  );
}

export default function CalendarPage() {
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<MonthResponse | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [error, setError] = useState("");
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    apiFetch<MonthResponse>(`/api/calendar?month=${month}&timezone=${encodeURIComponent(timezone)}`)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setSelectedDate((previous) => previous && result.days.some((day) => day.date === previous) ? previous : result.days.find((day) => day.date === result.today)?.date ?? result.days.at(-1)?.date ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load your calendar.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month]);

  const selected = data?.days.find((day) => day.date === selectedDate) ?? null;
  useEffect(() => { setNoteDraft(selected?.note ?? ""); }, [selectedDate, selected?.note]);

  const firstWeekday = useMemo(() => {
    const [year, number] = month.split("-").map(Number);
    return new Date(Date.UTC(year, number - 1, 1)).getUTCDay();
  }, [month]);
  const daysInMonth = useMemo(() => {
    const [year, number] = month.split("-").map(Number);
    return new Date(Date.UTC(year, number, 0)).getUTCDate();
  }, [month]);
  const byDate = new Map(data?.days.map((day) => [day.date, day]) ?? []);
  const nextMonth = moveMonth(month, 1);
  const maxMonth = data?.today.slice(0, 7) ?? currentMonth();

  async function saveNote() {
    if (!selectedDate || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await apiFetch<{ note: { text: string } | null }>("/api/calendar", {
        method: "PUT",
        body: JSON.stringify({ date: selectedDate, text: noteDraft }),
      });
      setData((current) => current ? { ...current, days: current.days.map((day) => day.date === selectedDate ? { ...day, note: result.note?.text ?? "" } : day) } : current);
      setNoteEditorOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="calendar-page min-h-0 flex-1">
      <NavBar />
      <main className="calendar-main mx-auto w-full max-w-6xl px-5 py-5 md:px-8">
        <div className="calendar-page-heading">
          <div>
            <p className="eyebrow">Your year in the stars</p>
            <h1>Luck calendar</h1>
            <p>Daily luck, body sign matches, Moon phase and your personal notes.</p>
          </div>
          <Link href="/home" className="calendar-back-link">← Daily reading</Link>
        </div>

        {error && <p className="calendar-error" role="alert">{error}{error.includes("birth profile") && <> <Link href="/home">Complete your profile</Link></>}</p>}

        <section className="calendar-month-card" aria-label={`${monthTitle(month)} calendar`}>
            <div className="calendar-month-heading">
              <button type="button" onClick={() => setMonth((value) => moveMonth(value, -1))} disabled={month <= `${new Date().getFullYear()}-01`} aria-label="Previous month">‹</button>
              <h2>{monthTitle(month)}</h2>
              <button type="button" onClick={() => setMonth((value) => moveMonth(value, 1))} disabled={nextMonth > maxMonth || loading} aria-label="Next month">›</button>
            </div>
            <div className="calendar-weekdays" aria-hidden="true">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name) => <span key={name}>{name}</span>)}</div>
            <div className="calendar-grid" style={{ "--calendar-weeks": Math.ceil((firstWeekday + daysInMonth) / 7) } as CSSProperties}>
              {Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} className="calendar-blank" />)}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const date = `${month}-${pad(index + 1)}`;
                const day = byDate.get(date);
                const future = Boolean(data && date > data.today);
                return (
                  <div key={date} className={`calendar-day ${date === data?.today ? "is-today" : ""} ${future ? "is-future" : ""}`} aria-label={`${date}${date === data?.today ? ", today" : ""}`}>
                    <div className="calendar-cell-top">
                      {day && <span className={`calendar-day-luck ${day.isEstimate ? "is-estimate" : ""}`} title={day.isEstimate ? "Transit estimate" : "Saved reading"}>Luck {day.luckScore}%</span>}
                    </div>
                    <div className="calendar-symptoms" aria-label={day?.symptoms.length ? `${day.symptoms.length} body signs` : undefined}>
                      {day?.symptoms.map((id) => {
                        const sign = PHYSICAL_SYMPTOMS.find((item) => item.id === id);
                        if (!sign) return null;
                        const side = sign.body.startsWith("L ") ? "L" : sign.body.startsWith("R ") ? "R" : "";
                        const rating = day.symptomRatings[id];
                        return <span key={id} className={rating ? `is-${rating}` : ""} title={`${sign.indicator}${rating ? ` · ${rating}` : ""}`}>{side}{sign.figure}</span>;
                      })}
                    </div>
                    <div className="calendar-note-preview">
                      {day?.note && <button type="button" title={day.note} aria-label={`Read or edit note for ${date}`} onClick={() => { setSelectedDate(date); setNoteDraft(day.note); setNoteEditorOpen(true); }}>{day.note}</button>}
                    </div>
                    {day ? <div className="calendar-cell-actions">
                      {day.luckChartAvailable ? <a className="calendar-snapshot-link" href={`/api/horoscope/luck-chart?date=${date}&w=1000&h=1500`} target="_blank" rel="noopener noreferrer" aria-label={`Open Luck Chart snapshot for ${date}`} title="Open Luck Chart snapshot">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></svg>
                      </a> : <span className="calendar-snapshot-link is-unavailable" aria-label="No Luck Chart snapshot saved for this date" title="No Luck Chart snapshot saved"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></svg></span>}
                      <button type="button" className={`calendar-note-add ${day.note ? "has-note" : ""}`} aria-label={`${day.note ? "Edit" : "Add"} note for ${date}`} title={day.note ? "Edit note" : "Add a note"} disabled={future || loading} onClick={() => { setSelectedDate(date); setNoteDraft(day.note); setNoteEditorOpen(true); }}>+</button>
                    </div> : <div className="calendar-cell-actions" />}
                    <div className="calendar-cell-bottom">
                      {day && <MoonPhaseImage illumination={day.moonIllumination} phase={day.moonPhase} date={date} />}
                      <span className="calendar-day-number">{index + 1}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="calendar-legend"><span><i className="legend-solid" /> Saved reading</span><span><i className="legend-outline" /> Transit estimate</span><span>＋ Add a date note</span></div>
            {loading && <div className="calendar-loading"><span className="output-loader" /> Loading month…</div>}
          </section>
      </main>
      {noteEditorOpen && selected && <div className="calendar-note-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setNoteEditorOpen(false); }}>
        <section className="calendar-note-dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-note-title">
          <button type="button" className="calendar-note-close" onClick={() => setNoteEditorOpen(false)} aria-label="Close note editor">×</button>
          <p className="eyebrow">{adToBs(selected.date) ? `Bikram Sambat ${adToBs(selected.date)}` : "Daily reflection"}</p>
          <h2 id="calendar-note-title">{new Date(`${selected.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}</h2>
          <textarea id="calendar-day-note" autoFocus value={noteDraft} maxLength={2000} placeholder="What happened on this day?" onChange={(event) => setNoteDraft(event.target.value)} />
          <div className="calendar-note-actions"><span>{noteDraft.length}/2000</span><button type="button" onClick={saveNote} disabled={saving}>{saving ? "Saving…" : "Save note"}</button></div>
        </section>
      </div>}
    </div>
  );
}
