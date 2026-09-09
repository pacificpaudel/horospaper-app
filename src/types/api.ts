import { AstrologySystem, Language, ImageStyle } from "./enums";

export interface BirthProfileDTO {
  id: string;
  name: string | null;
  birthDate: string;
  birthTime: string;
  birthLocation: string;
  latitude: number;
  longitude: number;
  timezone: string;
  astrologySystem: AstrologySystem;
  language: Language;
  imageStyle: ImageStyle;
}

export interface HoroscopeSectionsDTO {
  overall: string;
  love: string;
  career: string;
  money: string;
  energy: string;
  luckyTheme: string;
  focus: string;
  motivation: string;
  disclaimer: string;
}

export interface TransitAspectDTO {
  transitingPlanet: string;
  natalPlanet: string;
  aspect: string;
  nature: "harmonious" | "challenging" | "neutral";
  orb: number;
  description: string;
}

export interface StructuredAstrologyDataDTO {
  generationDate: string;
  system: AstrologySystem;
  sunSign: string;
  moonSign: string;
  ascendantSign: string | null;
  natalChart: {
    latitude: number;
    longitude: number;
    planets: Record<string, { planet: string; longitude: number; sign: string; degreeInSign: number; symbol: string; isRetrograde: boolean }>;
    ascendant: { longitude: number; sign: string; degreeInSign: number; symbol: string } | null;
  };
  today: {
    sunSign: string;
    moonSign: string;
    sunLongitude: number;
    moonLongitude: number;
    marsLongitude: number;
    saturnLongitude: number;
    moonPhaseName: string;
    moonIllumination: number;
    retrogradePlanets: string[];
  };
  transits: TransitAspectDTO[];
}

export interface HoroscopeDTO {
  id: string;
  userId: string;
  generationDate: string;
  astrologyData: StructuredAstrologyDataDTO;
  horoscopeText: HoroscopeSectionsDTO;
  imageUrl: string | null;
  imageStyle: ImageStyle;
  isPreview: boolean;
  createdAt: string;
}

