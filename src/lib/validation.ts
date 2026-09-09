import { z } from "zod";

export const BirthProfileInputSchema = z.object({
  name: z.string().trim().max(80).optional().or(z.literal("")),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Birth date must be YYYY-MM-DD"),
  birthTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Birth time must be HH:mm"),
  birthLocation: z.string().trim().min(2, "Birth location is required").max(200),
  astrologySystem: z.literal("VEDIC").default("VEDIC"),
  language: z.enum(["EN", "NE", "FI"]),
  imageStyle: z.literal("MIXED_MEDIA").default("MIXED_MEDIA"),
});

export type BirthProfileInput = z.infer<typeof BirthProfileInputSchema>;
