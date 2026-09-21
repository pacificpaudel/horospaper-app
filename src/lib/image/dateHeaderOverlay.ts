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
 * Draws the weekday name and a small "1st of Month Year" line, artistically
 * semi-transparent and centered at the top of a `width`x`height` canvas --
 * the day name reads as the "header" of this block and the date as its
 * smaller "footer" line, with a generous multi-line gap between them so the
 * pair reads as an intentional masthead rather than a cramped stack.
 */
export function buildDateHeaderMarkup(width: number, height: number, generationDate: string): string {
  const { weekday, dateLine } = describeDate(generationDate);
  const minDim = Math.min(width, height);
  const centerX = width / 2;
  const safeWidth = width * 0.82;

  const weekdayStyle: TextStyle = { color: "#ffffff", opacity: 0.62, strokeWidth: 0.09, tracking: 0.34 };
  const dateStyle: TextStyle = { color: "#f7c56a", opacity: 0.72, strokeWidth: 0.1, tracking: 0.28 };

  const weekdaySize = fitSize(weekday, minDim * 0.05, safeWidth, weekdayStyle);
  const dateSize = fitSize(dateLine, minDim * 0.022, safeWidth, dateStyle);

  const topMargin = Math.round(minDim * 0.05);
  const dateY = topMargin + weekdaySize + dateSize * 2; // ~2 lines' gap below the weekday name

  return [
    buildCenteredVectorTextMarkup(weekday, centerX, topMargin, weekdaySize, weekdayStyle),
    buildCenteredVectorTextMarkup(dateLine, centerX, dateY, dateSize, dateStyle),
  ].join("");
}
