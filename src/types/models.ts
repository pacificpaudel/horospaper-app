import { AstrologySystem, ImageStyle, Language } from "./enums";
import { StructuredAstrologyData } from "@/lib/astrology";
import { HoroscopeSections } from "@/lib/llm/types";
import type { DailyReading } from "@/lib/dailyReading";

export interface BirthProfile {
  id: string;
  userId: string;
  name: string | null;
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // "HH:mm" local time at birth location
  /** birthTime is the real clock time rather than a part-of-day midpoint; absent on older profiles. */
  birthTimeExact?: boolean;
  birthLocation: string;
  latitude: number;
  longitude: number;
  timezone: string;
  astrologySystem: AstrologySystem;
  language: Language;
  imageStyle: ImageStyle;
  createdAt: string;
  updatedAt: string;
}

export interface Horoscope {
  id: string;
  userId: string;
  generationDate: string; // YYYY-MM-DD
  astrologyData: StructuredAstrologyData;
  /** Luck % + the day's 2 tags; absent on horoscopes stored before it existed. */
  dailyReading?: DailyReading;
  horoscopeText: HoroscopeSections;
  imageUrl: string | null;
  imageUrlMobile: string | null;
  imageUrlFrame: string | null;
  imageStyle: ImageStyle;
  imagePrompt: string | null;
  isPreview: boolean;
  createdAt: string;
}
