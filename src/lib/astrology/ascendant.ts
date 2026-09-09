import * as Astronomy from "astronomy-engine";
import { normalizeDegrees } from "./zodiac";

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Computes the tropical ecliptic longitude of the Ascendant (rising sign)
 * for a given moment and geographic location, using the classic
 * RAMC/obliquity/latitude formula (Duffett-Smith, "Practical Astronomy").
 */
export function computeAscendantLongitude(date: Date, latitude: number, longitude: number): number {
  const time = Astronomy.MakeTime(date);
  const gastHours = Astronomy.SiderealTime(time); // Greenwich apparent sidereal time, in hours
  const ramcDeg = normalizeDegrees(gastHours * 15 + longitude); // Right ascension of the meridian
  const obliquityDeg = Astronomy.e_tilt(time).tobl; // true obliquity of the ecliptic

  const ramc = ramcDeg * DEG2RAD;
  const lat = latitude * DEG2RAD;
  const obl = obliquityDeg * DEG2RAD;

  const y = -Math.cos(ramc);
  const x = Math.sin(ramc) * Math.cos(obl) + Math.tan(lat) * Math.sin(obl);
  const ascRad = Math.atan2(y, x);

  return normalizeDegrees(ascRad * RAD2DEG);
}
