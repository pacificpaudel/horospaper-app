"use client";

import { useEffect, useRef, useState } from "react";
import { getStoredGuestId } from "@/lib/client/guest";
import { apiFetch } from "@/lib/client/api";
import type { LuckChartInfo } from "@/lib/image/gocharOverlay";
import { KeepAwake } from "./KeepAwake";
import { luckMeterPanel } from "@/lib/image/luckMeterGeometry";
import { PHYSICAL_SYMPTOMS, type PhysicalSymptomId, type PhysicalSymptomRatings, type SymptomRating } from "@/lib/physicalSymptoms";
import type { DailyPhysicalSymptomLog } from "@/lib/physicalSymptomLog";
import type { DailyReadingDTO } from "@/types/api";

/**
 * The "Luck Chart" button over a wallpaper image: centered just above the
 * luck percentage drawn near its bottom (never covering it), with the
 * percentage panel opens its score breakdown. The Luck Chart button opens
 * LuckChartView -- the chart and its Analysis, drawn fresh to fill the whole screen. The
 * image is shown with object-fit: contain inside the same box as this
 * layer, so `canvas` (the image's own size) is enough to place them.
 * Whether the view is open is owned by the page, so it survives the
 * wallpaper being swapped (and this layer remounted) at a new day and just
 * redraws for the new date.
 */
export function LuckChartLayer({
  canvas,
  hasChart,
  date,
  isPreview,
  reading,
  open,
  onOpenChange,
  detailsOpen,
  onDetailsOpenChange,
}: {
  canvas: { w: number; h: number };
  /** Whether the day has a Luck Chart to show (its reading has a kundli). */
  hasChart: boolean;
  date: string;
  isPreview: boolean;
  reading: DailyReadingDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detailsOpen: boolean;
  onDetailsOpenChange: (open: boolean) => void;
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

  let button: React.CSSProperties | null = null;
  let meter: React.CSSProperties | null = null;
  if (size && size.w > 0 && size.h > 0) {
    // Where object-fit: contain puts the image inside this layer's box.
    const scale = Math.min(size.w / canvas.w, size.h / canvas.h);
    const offsetX = (size.w - canvas.w * scale) / 2;
    const offsetY = (size.h - canvas.h * scale) / 2;
    const panel = luckMeterPanel(canvas.w, canvas.h);
    meter = { left: offsetX + panel.x * scale, top: offsetY + panel.y * scale, width: panel.w * scale, height: panel.h * scale };
    // Resting just above the percentage panel, clear of it.
    if (hasChart) button = { left: offsetX + (canvas.w / 2) * scale, top: offsetY + panel.y * scale - 6 };
  }

  const openChart = (e: React.MouseEvent) => {
    // Frame mode exits on any click that reaches its own container.
    e.stopPropagation();
    onOpenChange(true);
  };

  const openDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDetailsOpenChange(true);
  };

  return (
    <div ref={layerRef} className="luck-chart-layer">
      {meter && <button type="button" className="luck-chart-meter-hotspot" style={meter} aria-label={`Show how today's Luck score of ${reading.luckScore}% was calculated`} title="Show Luck score calculation" onClick={openDetails} />}
      {button && (
        <button type="button" className="luck-chart-button" style={button} onClick={openChart}>
          <span aria-hidden="true">✦</span> Luck Chart
        </button>
      )}
      {open && <LuckChartView date={date} isPreview={isPreview} onClose={() => onOpenChange(false)} />}
      {detailsOpen && <LuckCalculationDialog reading={reading} onClose={() => onDetailsOpenChange(false)} />}
    </div>
  );
}

function LuckCalculationDialog({ reading, onClose }: { reading: DailyReadingDTO; onClose: () => void }) {
  const calculation = reading.luckCalculation;
  const factors = calculation?.factors ?? [];
  const finalScore = Math.round(calculation?.weightedScore ?? reading.luckScore);
  const interpretation = finalScore >= 90 ? "Exceptional"
    : finalScore >= 80 ? "Highly favourable"
    : finalScore >= 70 ? "Favourable"
    : finalScore >= 60 ? "Moderately favourable"
    : finalScore >= 50 ? "Neutral"
    : finalScore >= 40 ? "Slightly unfavourable"
    : finalScore >= 25 ? "Unfavourable"
    : "Highly unfavourable";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="luck-calculation-backdrop" onClick={(event) => event.stopPropagation()} onMouseDown={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}>
      <section className="luck-calculation-dialog" role="dialog" aria-modal="true" aria-labelledby="luck-calculation-title">
        <button type="button" className="luck-chart-info-close" onClick={onClose} aria-label="Close calculation">×</button>
        <h2 id="luck-calculation-title">How today’s Luck score was calculated</h2>
        <p className="luck-calculation-intro">The score uses your ten-factor model. Each factor is rated from 0 to 100, then multiplied by its assigned weight.</p>
        {!calculation && <p className="luck-calculation-note">This saved wallpaper predates the ten-factor calculation and does not include its individual inputs. Refresh or regenerate today’s wallpaper to see the new calculation.</p>}
        <div className="luck-calculation-rows">
          {factors.map((source) => {
            const contribution = source.score * source.weight / 100;
            return (
              <article className="luck-calculation-row" key={source.id}>
                <div className="luck-calculation-row-heading">
                  <strong>{source.name}</strong>
                  <span>{source.score}/100 · {source.weight}%</span>
                </div>
                <p>{source.detail}</p>
                <small>{source.score} × {source.weight}% = {contribution.toFixed(2)} points{source.available ? "" : " · neutral fallback"}</small>
              </article>
            );
          })}
        </div>
        <div className="luck-calculation-formula">
          <strong>Σ (factor score × factor weight) ÷ 100</strong>
          {calculation && <span>Weighted total: {calculation.weightedScore.toFixed(2)}</span>}
          <b>Luck score: {finalScore}% — {interpretation}</b>
        </div>
        {calculation && <p className="luck-calculation-note">The weights total 100%; missing daily Panchang inputs use a visible neutral score of 50 and keep their assigned weight. The individual rating mappings are the app’s operational interpretation of the proposed model, not one universally fixed classical formula.</p>}
      </section>
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

/** What the server did with the event: made it, or handed back a pre-filled one to make. */
type EventResult = { kind: "created"; eventUrl: string; fileUrl: string } | { kind: "template"; templateUrl: string; imageUrl: string };

function LuckChartView({ date, isPreview, onClose }: { date: string; isPreview: boolean; onClose: () => void }) {
  const [chart, setChart] = useState<ChartImage | null>(null);
  const [failed, setFailed] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [eventOpen, setEventOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [symptoms, setSymptoms] = useState<PhysicalSymptomId[]>([]);
  const [symptomRatings, setSymptomRatings] = useState<PhysicalSymptomRatings>({});
  const [draftSymptoms, setDraftSymptoms] = useState<PhysicalSymptomId[]>([]);
  const [draftRatings, setDraftRatings] = useState<PhysicalSymptomRatings>({});
  const [physicalOpen, setPhysicalOpen] = useState(false);
  const [symptomsLoading, setSymptomsLoading] = useState(true);
  const [symptomsSaving, setSymptomsSaving] = useState(false);
  const [symptomsError, setSymptomsError] = useState<string | null>(null);
  const [eventBusy, setEventBusy] = useState(false);
  const [eventError, setEventError] = useState(false);
  const [eventResult, setEventResult] = useState<EventResult | null>(null);
  const [viewSize, setViewSize] = useState<{ w: number; h: number } | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSymptoms([]);
    setSymptomRatings({});
    setDraftSymptoms([]);
    setDraftRatings({});
    setPhysicalOpen(false);
    setSymptomsLoading(true);
    setSymptomsError(null);
    apiFetch<{ log: DailyPhysicalSymptomLog | null }>(`/api/horoscope/luck-chart/symptoms?date=${encodeURIComponent(date)}`)
      .then(({ log }) => {
        if (!cancelled && log) {
          setSymptoms(log.symptoms);
          setSymptomRatings(log.ratings ?? {});
        }
      })
      .catch(() => {
        if (!cancelled) setSymptomsError("Could not load this day’s saved body signs.");
      })
      .finally(() => {
        if (!cancelled) setSymptomsLoading(false);
      });
    return () => { cancelled = true; };
  }, [date]);

  const savePhysicalSymptoms = async () => {
    if (symptomsSaving || symptomsLoading) return;
    setSymptomsSaving(true);
    setSymptomsError(null);
    try {
      const { log } = await apiFetch<{ log: DailyPhysicalSymptomLog }>("/api/horoscope/luck-chart/symptoms", {
        method: "PUT",
        body: JSON.stringify({ date, symptoms: draftSymptoms, ratings: draftRatings }),
      });
      setSymptoms(log.symptoms);
      setSymptomRatings(log.ratings ?? {});
      setPhysicalOpen(false);
    } catch {
      setSymptomsError("Could not save body signs. Please try again.");
    } finally {
      setSymptomsSaving(false);
    }
  };

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
    // Escape closes whichever card is up first, then the view itself.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (infoOpen) setInfoOpen(false);
      else if (eventOpen) setEventOpen(false);
      else if (physicalOpen) setPhysicalOpen(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, infoOpen, eventOpen, physicalOpen]);

  // Each open starts clean -- including after a new day swapped the chart.
  const openEventCard = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEventError(false);
    setEventResult(null);
    setEventOpen(true);
  };

  /**
   * Hands the topic to the server, which draws the chart, keeps a copy in
   * the user's Drive (Horosevents) and makes the all-day event with that
   * copy attached. A guest who hasn't connected Google yet is sent to
   * consent, which finishes this same event and lands on it -- so the
   * event is never made without its screenshot either way.
   */
  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (eventBusy) return;
    setEventBusy(true);
    setEventError(false);
    try {
      const side = (n: number) => Math.min(2400, Math.max(200, Math.round(n)));
      const guestId = getStoredGuestId();
      const res = await fetch("/api/horoscope/luck-chart/event", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(guestId ? { "x-guest-id": guestId } : {}) },
        body: JSON.stringify({ date, topic: topic.trim(), symptoms, symptomRatings, w: side(window.innerWidth), h: side(window.innerHeight), preview: isPreview }),
      });
      const data = (await res.json().catch(() => null)) as (EventResult & { needsAuth?: boolean; authUrl?: string }) | null;
      if (res.status === 401 && data?.needsAuth && data.authUrl) {
        window.location.href = data.authUrl;
        return;
      }
      if (!res.ok || !data?.kind) throw new Error(String(res.status));
      setEventResult(data);
    } catch {
      setEventError(true);
    } finally {
      setEventBusy(false);
    }
  };

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
      {chart && (
        <button
          type="button"
          className="luck-chart-calendar-button"
          aria-label="Add today's Luck Chart to Google Calendar"
          title="Add to Google Calendar"
          disabled={symptomsLoading || symptomsSaving}
          onClick={openEventCard}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="2.5" />
            <path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
          </svg>
        </button>
      )}
      {chart && (
        <div className="luck-chart-physical" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="luck-chart-physical-toggle"
            aria-expanded={physicalOpen}
            aria-controls="luck-chart-physical-menu"
            aria-label="Traditional Hindu body signs"
            title={symptomsLoading ? "Loading saved body signs…" : "Traditional Hindu body signs"}
            disabled={symptomsLoading || symptomsSaving}
            onClick={() => {
              if (!physicalOpen) {
                setDraftSymptoms(symptoms);
                setDraftRatings(symptomRatings);
              }
              setPhysicalOpen((open) => !open);
            }}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <ellipse cx="12" cy="12" rx="9" ry="3.7" transform="rotate(-32 12 12)" />
              <ellipse cx="12" cy="12" rx="6.4" ry="2.4" transform="rotate(28 12 12)" />
              <path d="M8.3 13.8c1.2-2 3.3-3.6 6.1-4.4M10 9.1c2 .8 3.8 2.4 5 4.8" />
              <circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none" />
              <circle cx="4" cy="5" r=".7" fill="currentColor" stroke="none" />
              <circle cx="19.5" cy="18.7" r=".7" fill="currentColor" stroke="none" />
            </svg>
          </button>
          {physicalOpen && (
            <section className="luck-chart-physical-menu" id="luck-chart-physical-menu" aria-label="Choose traditional body signs">
              <div className="luck-chart-physical-menu-heading">
                <strong>Traditional Body Signs</strong>
                <span>{draftSymptoms.length}/3 selected</span>
              </div>
              <div className="luck-chart-physical-options">
                {PHYSICAL_SYMPTOMS.map((symptom) => {
                  const checked = draftSymptoms.includes(symptom.id);
                  const chooseRating = (rating: SymptomRating) => setDraftRatings((current) => ({ ...current, [symptom.id]: rating }));
                  return (
                    <div key={symptom.id} className="luck-chart-physical-option-wrap">
                      <label className="luck-chart-physical-option">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!checked && draftSymptoms.length >= 3}
                          onChange={() => {
                            if (checked) {
                              setDraftSymptoms((current) => current.filter((id) => id !== symptom.id));
                              setDraftRatings((current) => { const next = { ...current }; delete next[symptom.id]; return next; });
                            } else if (draftSymptoms.length < 3) {
                              setDraftSymptoms((current) => [...current, symptom.id]);
                            }
                          }}
                        />
                        <span className="luck-chart-physical-option-figure" aria-hidden="true">{symptom.figure}</span>
                        <span><strong>{symptom.body} · {symptom.indicator}</strong><small>{symptom.meaning}</small></span>
                      </label>
                      {checked && (
                        <div className="luck-chart-physical-rating" role="group" aria-label={`Did ${symptom.indicator} match an event?`}>
                          <span>Match?</span>
                          <button type="button" className={draftRatings[symptom.id] === "right" ? "is-selected" : ""} aria-pressed={draftRatings[symptom.id] === "right"} onClick={() => chooseRating("right")}>Right</button>
                          <button type="button" className={draftRatings[symptom.id] === "wrong" ? "is-selected" : ""} aria-pressed={draftRatings[symptom.id] === "wrong"} onClick={() => chooseRating("wrong")}>Wrong</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {symptomsError && <p className="luck-chart-physical-error" role="alert">{symptomsError}</p>}
              <button type="button" className="luck-chart-physical-save" disabled={symptomsSaving || symptomsLoading} onClick={savePhysicalSymptoms}>{symptomsSaving ? "Saving…" : "Save"}</button>
            </section>
          )}
          {symptoms.length > 0 && (
            <div className="luck-chart-physical-column" aria-label={`${symptoms.length} physical symptoms selected`}>
              {symptoms.map((id) => {
                const symptom = PHYSICAL_SYMPTOMS.find((item) => item.id === id)!;
                const side = symptom.body.startsWith("L ") ? "L" : symptom.body.startsWith("R ") ? "R" : "";
                const rating = symptomRatings[id];
                const ratingLabel = rating === "right" ? "Right" : rating === "wrong" ? "Wrong" : "";
                return <span key={id} className={rating ? `is-${rating}` : ""} title={`${symptom.indicator}: ${symptom.meaning}${ratingLabel ? ` (${ratingLabel})` : ""}`}>{side && <b>{side}</b>}{symptom.figure}</span>;
              })}
            </div>
          )}
        </div>
      )}
      {eventOpen && (
        <div
          className="luck-chart-info-backdrop"
          onClick={(e) => {
            e.stopPropagation();
            setEventOpen(false);
          }}
        >
          <form className="luck-chart-info luck-chart-event" aria-label="Add to Google Calendar" onClick={(e) => e.stopPropagation()} onSubmit={createEvent}>
            <button type="button" className="luck-chart-info-close" aria-label="Close" onClick={() => setEventOpen(false)}>
              ×
            </button>
            <h2>Add to Google Calendar</h2>
            {eventResult?.kind === "created" ? (
              <>
                <p className="luck-chart-event-note">
                  Event created on {date}, with the Luck Chart screenshot attached from your Drive folder <strong>Horosevents</strong>.
                </p>
                <a className="luck-chart-event-submit" href={eventResult.eventUrl} target="_blank" rel="noopener noreferrer">
                  Open the event
                </a>
                <a className="luck-chart-event-link" href={eventResult.fileUrl} target="_blank" rel="noopener noreferrer">
                  View the screenshot in Drive
                </a>
              </>
            ) : eventResult?.kind === "template" ? (
              <>
                <p className="luck-chart-event-note">
                  Google isn&apos;t connected, so the screenshot is stored here instead and its link is already in the event&apos;s description — open this to save the event.
                </p>
                <a className="luck-chart-event-submit" href={eventResult.templateUrl} target="_blank" rel="noopener noreferrer">
                  Open Google Calendar
                </a>
                <a className="luck-chart-event-link" href={eventResult.imageUrl} target="_blank" rel="noopener noreferrer">
                  View the screenshot
                </a>
              </>
            ) : (
              <>
                <label htmlFor="luck-chart-event-topic">Topic of event</label>
                <input
                  id="luck-chart-event-topic"
                  type="text"
                  value={topic}
                  autoFocus
                  maxLength={120}
                  placeholder={`Luck Chart ${date}`}
                  onChange={(e) => setTopic(e.target.value)}
                />
                <p className="luck-chart-event-note">
                  An all-day event on {date}. The Luck Chart screenshot is saved to <strong>Horosevents</strong> in your Google Drive and attached to the event, so it stays there after this app cleans up its own
                  files.
                </p>
                {symptoms.length > 0 && <p className="luck-chart-event-note">Traditional Hindu body signs: {symptoms.map((id) => { const item = PHYSICAL_SYMPTOMS.find((symptom) => symptom.id === id)!; const rating = symptomRatings[id]; return `${item.figure} ${item.indicator} — ${item.meaning}${rating ? ` (${rating === "right" ? "Right" : "Wrong"})` : ""}`; }).join(" · ")}</p>}
                {eventError && <p className="luck-chart-event-error">Couldn&apos;t make the event, so none was created. Try again.</p>}
                <button type="submit" className="luck-chart-event-submit" disabled={eventBusy}>
                  {eventBusy ? "Saving the screenshot…" : "Create event"}
                </button>
              </>
            )}
          </form>
        </div>
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
