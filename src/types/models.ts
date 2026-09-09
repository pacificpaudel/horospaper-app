import { AstrologySystem, ImageStyle, Language } from "./enums";
import { StructuredAstrologyData } from "@/lib/astrology";
import { HoroscopeSections } from "@/lib/llm/types";

export interface BirthProfile {
  id: string;
  userId: string;
  name: string | null;
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // "HH:mm" local time at birth location
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
  horoscopeText: HoroscopeSections;
  imageUrl: string | null;
  imageUrlMobile: string | null;
  imageStyle: ImageStyle;
  imagePrompt: string | null;
  isPreview: boolean;
  createdAt: string;
}
