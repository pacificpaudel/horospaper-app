import { ImageStyle } from "@prisma/client";
import { StructuredAstrologyData } from "@/lib/astrology";

const STYLE_DESCRIPTORS: Record<ImageStyle, string> = {
  COSMIC: "vast cosmic nebula, deep space, glowing stardust, rich purples and blues",
  MINIMAL: "minimalist line art, generous negative space, one or two accent colors",
  MYSTICAL: "mystical, ethereal, soft glowing light, symbolic celestial motifs",
  WATERCOLOR: "soft watercolor painting, flowing pigment bleeds, gentle pastel palette",
  RENAISSANCE: "renaissance oil painting style, classical celestial allegory, warm gold light",
  MODERN_CELESTIAL: "modern celestial illustration, clean geometric planets and orbits",
  DARK_SPACE: "dark, moody deep-space scene, high contrast, distant pinpoint stars",
  DREAMY: "dreamy, soft-focus, pastel gradient sky, floating light particles",
  ABSTRACT: "abstract expressionist interpretation of the cosmos, bold shapes and color fields",
  MIXED_MEDIA: "mixed media daybook art, layered paper textures, ink marks, painted shapes, tactile collage",
};

/**
 * Builds the image-generation prompt from structured astrology + horoscope
 * theme data. Deliberately excludes instructions to render text in the
 * image -- all text is overlaid afterward with HTML/CSS.
 */
export function buildImagePrompt(
  astrology: StructuredAstrologyData,
  opts: { style: ImageStyle; luckyTheme: string; emotionalTheme: string }
): string {
  const { sunSign, today } = astrology;

  return [
    `A beautiful, premium astrology artwork for a daily horoscope, no text or letters anywhere in the image.`,
    `Style: ${STYLE_DESCRIPTORS[opts.style]}.`,
    `Represent the zodiac sign ${sunSign} through subtle symbolic elements, not literal text.`,
    `Reflect a ${today.moonPhaseName.toLowerCase()} moon and a mood of "${opts.emotionalTheme}".`,
    `Lucky theme to evoke: ${opts.luckyTheme}.`,
    `Vertical portrait composition suitable for a 4:5 social media card, centered subject, balanced negative space near the top and bottom for text overlays.`,
  ].join(" ");
}
