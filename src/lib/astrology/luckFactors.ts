import type { NatalChart } from "@/lib/astrology/natalChart";
import { signIndex, NAKSHATRAS } from "@/lib/astrology/rashi";
import { normalizeDegrees, tropicalToSidereal } from "@/lib/astrology/zodiac";
import { meanRahuLongitude, type GocharReading } from "@/lib/astrology/gochar";
import { mahadashaOn, vimshottariMahadashas } from "@/lib/astrology/vimshottari";
import type { PanchangData } from "@/lib/panchang";

export interface LuckFactorResult {
  id: string;
  name: string;
  weight: number;
  score: number;
  detail: string;
  available: boolean;
}

export interface LuckCalculation {
  method: "hindu-10-factor-v2";
  factors: LuckFactorResult[];
  weightedScore: number;
}

const TITHI_WEIGHTS: Record<number, { name: string; score: number }> = {
  1: { name: "Nanda", score: 75 }, 2: { name: "Bhadra", score: 75 }, 3: { name: "Jaya", score: 80 },
  4: { name: "Rikta", score: 30 }, 5: { name: "Purna", score: 80 }, 6: { name: "Nanda", score: 75 },
  7: { name: "Bhadra", score: 75 }, 8: { name: "Jaya", score: 80 }, 9: { name: "Rikta", score: 30 },
  10: { name: "Purna", score: 80 }, 11: { name: "Nanda", score: 75 }, 12: { name: "Bhadra", score: 75 },
  13: { name: "Jaya", score: 80 }, 14: { name: "Rikta", score: 30 }, 15: { name: "Purna", score: 80 },
};

const NAKSHATRA_GROUPS: Record<string, number[]> = {
  Dhruva: [4, 12, 21, 26],
  Chara: [7, 15, 22, 23, 24],
  Ugra: [2, 10, 11, 20, 25],
  Mishra: [3, 16],
  Tikshna: [6, 9, 18, 19],
  Mridu: [5, 14, 17, 27],
  Kshipra: [1, 8, 13],
};

const NAKSHATRA_SCORES: Record<string, number> = {
  Dhruva: 85, Chara: 65, Ugra: 35, Mishra: 55, Tikshna: 30, Mridu: 75, Kshipra: 80,
};

const YOGA_SCORES = [60, 80, 80, 80, 80, 25, 80, 80, 25, 25, 80, 80, 25, 80, 45, 80, 25, 75, 45, 80, 80, 75, 80, 80, 80, 80, 25];
const YOGA_NAMES = [
  "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarma", "Dhriti", "Shoola",
  "Ganda", "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyana",
  "Parigha", "Shiva", "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti",
];

const WEEKDAY_SCORES = [60, 70, 55, 75, 80, 75, 50];
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const RAHU_SEGMENT = [8, 2, 7, 5, 6, 4, 3];
const YAMAGANDA_SEGMENT = [5, 4, 3, 2, 1, 7, 6];
const GULIKA_SEGMENT = [7, 6, 5, 4, 3, 2, 1];

function factor(id: string, name: string, weight: number, score: number, detail: string, available = true): LuckFactorResult {
  const bounded = Math.max(0, Math.min(100, score));
  return { id, name, weight, score: Math.round(bounded * 10) / 10, detail, available };
}

function unavailable(id: string, name: string, weight: number, detail: string): LuckFactorResult {
  return factor(id, name, weight, 50, `${detail} A neutral score of 50 is used until this data is available.`, false);
}

function tithiRating(number: number, paksha: string): { score: number; group: string } {
  const n = ((number - 1) % 15) + 1;
  const group = TITHI_WEIGHTS[n];
  let score = group.score;
  if (n === 15 && (number > 15 || /krishna|कृष्ण/i.test(paksha))) score = 25; // Amavasya
  if (n === 15 && (number <= 15 || /shukla|शुक्ल/i.test(paksha))) score = 85; // Purnima
  return { score, group: group.name };
}

function panchangTithi(data: PanchangData | null): LuckFactorResult {
  const weight = 10;
  if (!data?.tithi?.number) return unavailable("tithi", "Tithi", weight, "Daily tithi data is unavailable.");
  const current = tithiRating(data.tithi.number, data.tithi.paksha);
  const nextNumber = data.tithi.number % 30 + 1;
  const nextPaksha = nextNumber <= 15 ? "Shukla" : "Krishna";
  const next = tithiRating(nextNumber, nextPaksha);
  const weighted = daylightTransitionScore(data, current.score, data.tithi.endsAt ? [{ at: data.tithi.endsAt, score: next.score, label: `next tithi (${nextPaksha}, ${next.group})` }] : []);
  const score = weighted?.score ?? current.score;
  const transition = weighted?.changes ?? `${data.tithi.name} (${data.tithi.paksha}), ${current.group} class at sunrise`;
  return factor("tithi", "Tithi", weight, score, `${transition}. Daylight-weighted app rating: ${score.toFixed(1)}/100.`);
}

function nakshatraGroup(number: number): string | null {
  return Object.entries(NAKSHATRA_GROUPS).find(([, members]) => members.includes(number))?.[0] ?? null;
}

function dailyNakshatra(data: PanchangData | null, natalChart: NatalChart): LuckFactorResult {
  const weight = 15;
  if (!data?.nakshatra?.number) return unavailable("nakshatra", "Nakshatra", weight, "Daily nakshatra data is unavailable.");
  const group = nakshatraGroup(data.nakshatra.number);
  if (!group) return unavailable("nakshatra", "Nakshatra", weight, "The daily nakshatra could not be classified.");
  const nextNumber = data.nakshatra.number % 27 + 1;
  const nextGroup = nakshatraGroup(nextNumber);
  const weighted = nextGroup && data.nakshatra.endsAt
    ? daylightTransitionScore(data, NAKSHATRA_SCORES[group], [{ at: data.nakshatra.endsAt, score: NAKSHATRA_SCORES[nextGroup], label: `next nakshatra (${nextGroup})` }])
    : null;
  const score = weighted?.score ?? NAKSHATRA_SCORES[group];
  const birthIndex = Math.floor(normalizeDegrees(natalChart.planets.moon.longitude) / (360 / 27));
  const birthStar = NAKSHATRAS[birthIndex] ?? "Unknown";
  const transition = weighted?.changes ?? `${data.nakshatra.name} (${group} class) at sunrise`;
  return factor("nakshatra", "Nakshatra", weight, score, `Birth star ${birthStar}; ${transition}. Tara compatibility is scored separately. Daylight-weighted app rating: ${score.toFixed(1)}/100.`);
}

function vara(date: string): LuckFactorResult {
  const weight = 5;
  const [year, month, day] = date.split("-").map(Number);
  const dayIndex = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return factor("vara", "Vara (weekday)", weight, WEEKDAY_SCORES[dayIndex], `${WEEKDAY_NAMES[dayIndex]}; app uses a general weekday association rating, not an activity-specific muhurta.`);
}

function nityaYoga(data: PanchangData | null): LuckFactorResult {
  const weight = 8;
  const number = data?.yoga?.number;
  if (!number || number < 1 || number > 27) return unavailable("yoga", "Yoga", weight, "Daily Nitya Yoga data is unavailable.");
  const nextNumber = number % 27 + 1;
  const weighted = data?.yoga?.endsAt
    ? daylightTransitionScore(data, YOGA_SCORES[number - 1], [{ at: data.yoga.endsAt, score: YOGA_SCORES[nextNumber - 1], label: `next yoga (${YOGA_NAMES[nextNumber - 1]})` }])
    : null;
  const score = weighted?.score ?? YOGA_SCORES[number - 1];
  const transition = weighted?.changes ?? `${YOGA_NAMES[number - 1]} (${number}/27) at sunrise`;
  return factor("yoga", "Yoga", weight, score, `${transition}. Rating follows the app's general auspicious, mixed, and challenging grouping. Daylight-weighted app rating: ${score.toFixed(1)}/100.`);
}

function karanaRating(name: string): number | null {
  const normalized = name.toLowerCase().replace(/[\s-]/g, "");
  if (/vishti|bhadra|विष्टि|भद्रा/.test(normalized)) return 20;
  if (/bava|balava|kaulava|taitila|garaja|gara|vanija|बव|बालव|कौलव|तैतिल|गर|वणिज/.test(normalized)) return 80;
  if (/kimstughna|किंस्तुघ्न/.test(normalized)) return 65;
  if (/shakuni|chatushpada|naga|शकुनि|चतुष्पद|नाग/.test(normalized)) return 35;
  return null;
}

function karana(data: PanchangData | null): LuckFactorResult {
  const weight = 4;
  const karanas = data?.karanas?.length ? data.karanas : data?.karana?.name ? [data.karana] : [];
  const name = karanas[0]?.name?.trim();
  if (!name) return unavailable("karana", "Karana", weight, "Daily karana data is unavailable.");
  const ratings = karanas.map((item) => ({ ...item, score: karanaRating(item.name) }));
  if (ratings.some((item) => item.score === null)) return unavailable("karana", "Karana", weight, `Karana “${ratings.find((item) => item.score === null)?.name}” is not in the app's rating table.`);
  const changes = ratings.slice(1).map((item, index) => ({ at: ratings[index].endsAt ?? "", score: item.score as number, label: item.name }));
  const weighted = daylightTransitionScore(data!, ratings[0].score!, changes.filter((change) => change.at));
  const score = weighted?.score ?? ratings[0].score!;
  const transition = weighted?.changes ?? `${name} at sunrise`;
  return factor("karana", "Karana", weight, score, `${transition}; daylight-weighted traditional category rating: ${score.toFixed(1)}/100.`);
}

function chandraBala(planetary: GocharReading, sunLongitude: number, moonLongitude: number): LuckFactorResult {
  const weight = 12;
  const house = planetary.moonHouse;
  const elongation = normalizeDegrees(moonLongitude - sunLongitude);
  const waxing = elongation < 180;
  const scores: Record<number, number> = { 1: 80, 2: waxing ? 70 : 50, 3: 80, 4: 40, 5: waxing ? 70 : 50, 6: 80, 7: 80, 8: 20, 9: waxing ? 70 : 50, 10: 80, 11: 80, 12: 30 };
  const score = scores[house] ?? 50;
  return factor("chandra-bala", "Chandra Bala", weight, score, `Transit Moon is ${house}th from the birth Moon; ${waxing ? "waxing" : "waning"} phase. App rating: ${score}/100.`);
}

function taraBala(planetary: GocharReading): LuckFactorResult {
  const weight = 12;
  const score = 50 + planetary.tara.score * 50;
  return factor("tara-bala", "Tara Bala", weight, score, `${planetary.tara.name} Tara; compatibility sentiment ${planetary.tara.score > 0 ? "+" : ""}${planetary.tara.score.toFixed(2)} mapped to ${Math.round(score)}/100.`);
}

function planetaryTransits(planetary: GocharReading): LuckFactorResult {
  const weight = 15;
  const score = 50 + planetary.gocharScore * 50;
  return factor("planetary-transits", "Planetary positions and transits", weight, score, `Weighted transit-house result ${planetary.gocharScore > 0 ? "+" : ""}${planetary.gocharScore.toFixed(2)} (including transit vedha), mapped to ${Math.round(score)}/100.`);
}

const SIGN_NAMES = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"];
const LORD_KEYS: Record<string, string> = { Sun: "sun", Moon: "moon", Mars: "mars", Mercury: "mercury", Jupiter: "jupiter", Venus: "venus", Saturn: "saturn" };
const EXALTED: Record<string, number> = { Sun: 0, Moon: 1, Mars: 9, Mercury: 5, Jupiter: 3, Venus: 11, Saturn: 6 };
const DEBILITATED: Record<string, number> = { Sun: 6, Moon: 7, Mars: 3, Mercury: 11, Jupiter: 9, Venus: 5, Saturn: 0 };
const OWN_SIGNS: Record<string, number[]> = { Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11], Venus: [1, 6], Saturn: [9, 10] };

function dashaLordStrength(lord: string, natalChart: NatalChart): { score: number; detail: string } {
  const birth = new Date(natalChart.birthDateTimeUtc);
  const rahu = tropicalToSidereal(meanRahuLongitude(birth), birth);
  let longitude: number | undefined;
  const key = LORD_KEYS[lord];
  if (key) longitude = natalChart.planets[key as keyof typeof natalChart.planets]?.longitude;
  if (lord === "Rahu") longitude = rahu;
  if (lord === "Ketu") longitude = normalizeDegrees(rahu + 180);
  if (longitude === undefined) return { score: 50, detail: `${lord}: natal placement unavailable` };

  const sign = signIndex(longitude);
  const ascendant = natalChart.ascendant ? signIndex(natalChart.ascendant.longitude) : signIndex(natalChart.planets.moon.longitude);
  const house = ((sign - ascendant + 12) % 12) + 1;
  let score = 55;
  if (["Jupiter", "Venus", "Mercury", "Moon"].includes(lord)) score += 8;
  if (["Mars", "Saturn", "Rahu", "Ketu"].includes(lord)) score -= 5;
  if (EXALTED[lord] === sign) score += 15;
  else if (DEBILITATED[lord] === sign) score -= 15;
  else if (OWN_SIGNS[lord]?.includes(sign)) score += 10;
  if ([1, 5, 9].includes(house)) score += 12;
  else if ([4, 7, 10].includes(house)) score += 6;
  else if ([6, 8, 12].includes(house)) score -= 10;
  score = Math.max(0, Math.min(100, score));
  return { score, detail: `${lord} in ${SIGN_NAMES[sign]}, natal house ${house}: ${Math.round(score)}/100` };
}

function dashaScore(natalChart: NatalChart, date: string): LuckFactorResult {
  const weight = 12;
  const birth = new Date(natalChart.birthDateTimeUtc);
  const periods = vimshottariMahadashas(natalChart.planets.moon.longitude, birth);
  const maha = mahadashaOn(periods, date);
  if (!maha) return unavailable("dasha", "Dasha and Antardasha", weight, "The current Vimshottari period could not be determined.");

  const mahadashaStart = Date.parse(`${maha.start}T00:00:00Z`);
  const mahadashaEnd = Date.parse(`${maha.end}T00:00:00Z`);
  const day = Date.parse(`${date}T12:00:00Z`);
  const duration = mahadashaEnd - mahadashaStart;
  const order = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"];
  const years: Record<string, number> = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };
  const startIndex = order.indexOf(maha.lord);
  let cursor = mahadashaStart;
  let antardashaLord = maha.lord;
  for (let offset = 0; offset < 9; offset++) {
    const lord = order[(startIndex + offset) % 9];
    const end = cursor + duration * years[lord] / 120;
    if (day >= cursor && day < end) {
      antardashaLord = lord;
      break;
    }
    cursor = end;
  }
  const mahaQuality = dashaLordStrength(maha.lord, natalChart);
  const antarQuality = dashaLordStrength(antardashaLord, natalChart);
  const score = (mahaQuality.score + antarQuality.score) / 2;
  return factor("dasha", "Dasha and Antardasha", weight, score, `Vimshottari ${maha.lord} Mahadasha / ${antardashaLord} Antardasha. ${mahaQuality.detail}; ${antarQuality.detail}.`);
}

function parseClock(value: string): number | null {
  const match = value.match(/(?:T|\b)(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (minute > 59 || hour > 23 || (meridiem && hour > 12)) return null;
  if (meridiem === "AM" && hour === 12) hour = 0;
  if (meridiem === "PM" && hour < 12) hour += 12;
  return hour * 60 + minute;
}

/** Panchang transition clocks may exceed 24:00 when they end after midnight. */
function parsePanchangClock(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  if (hour > 47 || minute > 59 || second > 59) return null;
  return hour * 60 + minute + second / 60;
}

/**
 * Average a sunrise Panchang rating over daylight, applying provider supplied
 * local transition times. If sunrise/sunset or transitions are unavailable,
 * callers retain the sunrise rating instead of guessing at durations.
 */
function daylightTransitionScore(
  data: PanchangData,
  initialScore: number,
  transitions: { at: string; score: number; label: string }[]
): { score: number; changes: string } | null {
  if (transitions.length === 0) return null;
  const sunrise = parseClock(data.sunrise);
  const sunset = parseClock(data.sunset);
  if (sunrise === null || sunset === null || sunset <= sunrise) return null;

  const changes = transitions
    .map((transition) => ({ ...transition, minute: parsePanchangClock(transition.at) }))
    .filter((transition): transition is typeof transition & { minute: number } =>
      transition.minute !== null && transition.minute > sunrise && transition.minute < sunset
    )
    .sort((a, b) => a.minute - b.minute);
  if (changes.length === 0) return null;

  const daylightMinutes = sunset - sunrise;
  const segments: { score: number; label: string; minutes: number }[] = [];
  let cursor = sunrise;
  let currentScore = initialScore;
  let currentLabel = "Sunrise value";
  for (const change of changes) {
    if (change.minute > cursor) segments.push({ score: currentScore, label: currentLabel, minutes: change.minute - cursor });
    cursor = change.minute;
    currentScore = change.score;
    currentLabel = change.label;
  }
  if (cursor < sunset) segments.push({ score: currentScore, label: currentLabel, minutes: sunset - cursor });
  const score = segments.reduce((sum, segment) => sum + segment.score * segment.minutes / daylightMinutes, 0);
  const detail = segments.map((segment) => `${segment.label} ${Math.round(segment.score)}/100 for ${Math.round(segment.minutes / daylightMinutes * 100)}%`).join(", ");
  return { score, changes: `${detail} of daylight` };
}

function rahuGulikaYamaganda(data: PanchangData | null, date: string): LuckFactorResult {
  const weight = 7;
  if (!data?.sunrise || !data.sunset) return unavailable("inauspicious-periods", "Rahu Kaal, Gulika Kaal and Yamaganda", weight, "Sunrise or sunset data is unavailable.");
  const sunrise = parseClock(data.sunrise);
  const sunset = parseClock(data.sunset);
  if (sunrise === null || sunset === null || sunset <= sunrise) return unavailable("inauspicious-periods", "Rahu Kaal, Gulika Kaal and Yamaganda", weight, "Sunrise and sunset could not be parsed.");
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  const length = sunset - sunrise;
  const segments = [RAHU_SEGMENT[weekday], YAMAGANDA_SEGMENT[weekday], GULIKA_SEGMENT[weekday]];
  const intervals = segments.map((segment, index) => ({
    name: ["Rahu Kaal", "Yamaganda", "Gulika Kaal"][index],
    start: sunrise + (segment - 1) * length / 8,
    end: sunrise + segment * length / 8,
  })).sort((a, b) => a.start - b.start);
  let occupied = 0;
  let currentStart = intervals[0].start;
  let currentEnd = intervals[0].end;
  for (const interval of intervals.slice(1)) {
    if (interval.start <= currentEnd) currentEnd = Math.max(currentEnd, interval.end);
    else { occupied += currentEnd - currentStart; currentStart = interval.start; currentEnd = interval.end; }
  }
  occupied += currentEnd - currentStart;
  const usable = Math.max(0, 100 * (1 - occupied / length));
  const periods = intervals.map((interval) => `${interval.name} ${formatClock(interval.start)}–${formatClock(interval.end)}`).join("; ");
  return factor("inauspicious-periods", "Rahu Kaal, Gulika Kaal and Yamaganda", weight, usable, `Daylight-only score: ${periods}. ${Math.round(usable)}% of daylight remains outside these intervals.`);
}

function formatClock(minutes: number): string {
  const total = Math.round(minutes);
  const hour = Math.floor(total / 60) % 24;
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function calculateLuckFactors(params: {
  natalChart: NatalChart;
  sunLongitude: number;
  moonLongitude: number;
  planetary: GocharReading;
  panchang: PanchangData | null;
  date: string;
}): LuckCalculation {
  const { natalChart, sunLongitude, moonLongitude, planetary, panchang, date } = params;
  const nakshatraScore = dailyNakshatra(panchang, natalChart);
  const factors = [
    panchangTithi(panchang),
    nakshatraScore,
    vara(date),
    nityaYoga(panchang),
    karana(panchang),
    chandraBala(planetary, sunLongitude, moonLongitude),
    taraBala(planetary),
    planetaryTransits(planetary),
    dashaScore(natalChart, date),
    rahuGulikaYamaganda(panchang, date),
  ];
  const weightedScore = factors.reduce((sum, item) => sum + item.score * item.weight / 100, 0);
  return { method: "hindu-10-factor-v2", factors, weightedScore: Math.round(weightedScore * 100) / 100 };
}
