import { StructuredAstrologyData } from "@/lib/astrology";
import { HoroscopeSections } from "./types";

const DISCLAIMER = "Astrology is provided for entertainment and personal reflection.";

/**
 * Deterministic, template-based horoscope generator used when no LLM API
 * key is configured. Produces varied but non-random output by weaving in
 * the actual structured astrology data, so the app stays fully functional
 * in local development without credentials.
 */
export function generateMockHoroscope(
  astrology: StructuredAstrologyData,
  name?: string | null
): HoroscopeSections {
  const who = name ? name : "you";
  const { sunSign, moonSign, today, transits } = astrology;
  const leadTransit = transits[0];

  const overall = `Today favors ${who} leaning into the steady blend of ${sunSign} clarity and a ${today.moonPhaseName.toLowerCase()} in ${today.moonSign}. ${
    leadTransit
      ? `With ${leadTransit.description.toLowerCase()}, the day carries a ${leadTransit.nature} undertone worth noticing.`
      : "The sky is calm, which is a good day to simply keep your usual rhythm."
  } Pay attention to small moments that ask for your attention rather than forcing big decisions.`;

  const love = `In matters of the heart, this is a good day to listen more than you speak. Your natal Moon in ${moonSign} might notice feelings surfacing that are worth naming gently, whether with a partner, friend, or yourself.`;

  const career = `At work, today favors steady, practical progress over dramatic moves. You might notice a task that's been waiting for a clear head -- this is a good day to return to it.`;

  const money = `Financially, pay attention to small recurring costs rather than big purchases. Today favors reviewing rather than spending; a good day to make a simple plan instead of an impulsive choice.`;

  const energy = `Your energy today is shaped by the ${today.moonPhaseName.toLowerCase()}${
    today.retrogradePlanets.length ? `, with ${today.retrogradePlanets.join(", ")} retrograde asking for a little more patience` : ""
  }. You might notice you need more rest than usual, or a short walk to reset.`;

  return {
    overall,
    love,
    career,
    money,
    energy,
    luckyTheme: `${sunSign} steadiness`,
    focus: `Today's focus: notice one thing in the ${today.moonSign} moon's mood that you'd normally rush past, and give it a moment of real attention.`,
    motivation: "One small, honest step today is enough.",
    disclaimer: DISCLAIMER,
  };
}
