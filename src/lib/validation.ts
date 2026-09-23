import { z } from "zod";

export function isValidTimeZone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export const BirthProfileInputSchema = z.object({
  name: z.string().trim().max(80).optional().or(z.literal("")),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Birth date must be YYYY-MM-DD"),
  birthTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Birth time must be HH:mm"),
  birthLocation: z.string().trim().min(2, "Birth location is required").max(200),
  // Sent when the location was picked from the city list, so it needn't be
  // geocoded; free-text locations omit them and are geocoded instead.
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  // A user-picked IANA zone (e.g. "Asia/Kathmandu") instead of one estimated
  // from birth-location coordinates -- that estimate was only accurate to
  // the nearest 15-degree longitude band and ignored real timezone/DST
  // boundaries entirely, which threw off both the natal chart's birth-time
  // conversion and the daily wallpaper's "today" boundary.
  timezone: z.string().trim().min(1, "Timezone is required").refine(isValidTimeZone, "Not a recognized timezone"),
  astrologySystem: z.literal("VEDIC").default("VEDIC"),
  language: z.enum(["EN", "NE", "FI"]),
  imageStyle: z.literal("MIXED_MEDIA").default("MIXED_MEDIA"),
});

export type BirthProfileInput = z.infer<typeof BirthProfileInputSchema>;
