import { buildCenteredVectorTextMarkup, measureVectorText, TextStyle } from "./vectorFont";

const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

function ordinalSuffix(day: number): string {
  if (day % 10 === 1 && day % 100 !== 11) return "ST";
  if (day % 10 === 2 && day % 100 !== 12) return "ND";
  if (day % 10 === 3 && day % 100 !== 13) return "RD";
  return "TH";
}

/**
 * `generationDate` is already the correct "YYYY-MM-DD" calendar day in the
 * user's own timezone (see todayForTimezone / dateOnlyString) -- parsing it
 * as plain Y/M/D components anchored to UTC noon (rather than re-parsing it
 * through a timezone-sensitive Date constructor) avoids reintroducing the
 * exact class of off-by-one-day bug fixed for the wallpaper's "today"
 * elsewhere in this app.
 */
function describeDate(generationDate: string): { weekday: string; dateLine: string } {
  const [year, month, day] = generationDate.split("-").map(Number);
  const anchor = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekday = WEEKDAYS[anchor.getUTCDay()];
  const monthName = MONTHS[month - 1];
  return { weekday, dateLine: `${day}${ordinalSuffix(day)} OF ${monthName} ${year}` };
}

/**
 * Shrinks `size` just enough that `text` fits within `maxWidth`, so long
 * month names or a 4-digit year never collide with the corner planet
 * diagrams (see planetDiagram.ts) on a narrow mobile canvas.
 */
function fitSize(text: string, idealSize: number, maxWidth: number, style: TextStyle): number {
  const idealWidth = measureVectorText(text, idealSize, style);
  if (idealWidth <= maxWidth) return idealSize;
  return idealSize * (maxWidth / idealWidth);
}

/**
 * A rounded dark backdrop rect spanning [top, bottom], wide enough for
 * `contentWidth` -- the same legibility technique buildLuckMeterMarkup
 * already uses for its percentage. `size` only drives the horizontal
 * padding and corner radius, so it should be the size of the largest text
 * line the panel covers.
 */
function panelRect(contentWidth: number, centerX: number, top: number, bottom: number, size: number): string {
  const padX = Math.round(size * 1.3);
  return `<rect x="${(centerX - contentWidth / 2 - padX).toFixed(1)}" y="${top.toFixed(1)}" width="${(contentWidth + padX * 2).toFixed(1)}" height="${(bottom - top).toFixed(1)}" rx="${(size * 0.9).toFixed(1)}" fill="#0b1220" fill-opacity="0.48" />`;
}

/**
 * Draws the weekday name and a small "1st of Month Year" line, artistically
 * semi-transparent and centered at the top of a `width`x`height` canvas --
 * the day name reads as the "header" of this block and the date as its
 * smaller "footer" line, with a generous multi-line gap between them so the
 * pair reads as an intentional masthead rather than a cramped stack. A soft
 * dark backdrop panel sits behind both lines so the text stays legible over
 * any photo, not just the ones dark enough for colored strokes to show up
 * well on their own.
 *
 * When `tags` are given (the day's tags -- one per luck source, see
 * dailyReading.ts), a second, separate panel is drawn just below the
 * date -- same vector font and proportions as the date line, in gold
 * instead of blue, reading as a distinct "today's intent" callout rather
 * than part of the date itself.
 */
export interface DateHeader {
  markup: string;
  /** The weekday + date panel. */
  dateBox: { x: number; y: number; w: number; h: number };
  /** Bottom and right edges of everything drawn (the tags panel when `tags` are given). */
  bottom: number;
  right: number;
}

/**
 * `insertHeight` leaves that much room between the date panel and the
 * tags panel, for something drawn right under the date (the Schumann
 * graph -- see compositeOverlay.ts).
 */
export function buildDateHeader(width: number, height: number, generationDate: string, tags?: string[], insertHeight = 0): DateHeader {
  return dateHeaderLayout(width, height, generationDate, tags, insertHeight);
}

function dateHeaderLayout(width: number, height: number, generationDate: string, tags?: string[], insertHeight = 0): DateHeader {
  const { weekday, dateLine } = describeDate(generationDate);
  const minDim = Math.min(width, height);
  const centerX = width / 2;
  const safeWidth = width * 0.82;

  const weekdayStyle: TextStyle = { color: "#39e991", opacity: 0.92, strokeWidth: 0.09, tracking: 0.34 };
  const dateStyle: TextStyle = { color: "#4fb8f7", opacity: 0.94, strokeWidth: 0.1, tracking: 0.28 };

  const weekdaySize = fitSize(weekday, minDim * 0.05, safeWidth, weekdayStyle);
  const dateSize = fitSize(dateLine, minDim * 0.022, safeWidth, dateStyle);

  const topMargin = Math.round(minDim * 0.05);
  const dateY = topMargin + weekdaySize + dateSize * 2; // ~2 lines' gap below the weekday name

  const blockWidth = Math.max(measureVectorText(weekday, weekdaySize, weekdayStyle), measureVectorText(dateLine, dateSize, dateStyle));
  const padTop = Math.round(dateSize * 1.1);
  const padBottom = Math.round(dateSize * 1.1);
  const backdropTop = topMargin - padTop;
  const backdropBottom = dateY + dateSize + padBottom;
  const backdrop = panelRect(blockWidth, centerX, backdropTop, backdropBottom, dateSize);
  const boxPadX = Math.round(dateSize * 1.3); // as in panelRect
  const dateBox = { x: centerX - blockWidth / 2 - boxPadX, y: backdropTop, w: blockWidth + boxPadX * 2, h: backdropBottom - backdropTop };
  const right = dateBox.x + dateBox.w;

  const markup = [
    backdrop,
    buildCenteredVectorTextMarkup(weekday, centerX, topMargin, weekdaySize, weekdayStyle),
    buildCenteredVectorTextMarkup(dateLine, centerX, dateY, dateSize, dateStyle),
  ];

  let bottom = backdropBottom + insertHeight;
  if (tags?.length) {
    // All the tags on one line, shrunk to fit inside the date panel's own
    // width, on a panel exactly that wide -- so the header block is one
    // neat column.
    const intentStyle: TextStyle = { ...dateStyle, color: "#f7c56a" };
    const text = tags.join(" · ").toUpperCase();
    const innerPad = dateBox.w * 0.06;
    const intentSize = fitSize(text, dateSize, dateBox.w - innerPad * 2, intentStyle);
    const intentPad = Math.round(Math.max(intentSize, dateSize * 0.75) * 1.1);
    const panelTop = bottom + Math.round(dateSize * 0.3);
    const intentY = panelTop + intentPad;
    bottom = intentY + intentSize + intentPad;
    markup.push(
      `<rect x="${dateBox.x.toFixed(1)}" y="${panelTop.toFixed(1)}" width="${dateBox.w.toFixed(1)}" height="${(bottom - panelTop).toFixed(1)}" rx="${(intentSize * 0.9).toFixed(1)}" fill="#0b1220" fill-opacity="0.48" />`,
      buildCenteredVectorTextMarkup(text, centerX, intentY, intentSize, intentStyle)
    );
  }

  return { markup: markup.join(""), dateBox, bottom, right };
}
