import { HoroscopeSections } from "./types";

// Google Gemini, via its OpenAI-compatible endpoint (a free Google AI
// Studio key, no credit card) -- same request/response shape as
// openaiProvider.ts, just a different host/model, so it slots into the
// same fallback chain (see generateHoroscope.ts's providerOrder()).
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const DISCLAIMER = "Astrology is provided for entertainment and personal reflection.";

function extractJson(text: string): Record<string, string> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("LLM response did not contain a JSON object");
  return JSON.parse(match[0]);
}

async function completeWithGemini(prompt: string, model: string, temperature: number): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini request failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message?.content ?? "";
}

// Flash-Lite for both calls: testing showed the non-Lite gemini-3.5-flash
// hits "prepayment credits are depleted" (402) on a free-tier key --
// billed pay-as-you-go rather than covered by the free quota -- while
// Flash-Lite has run cleanly on every call. Stick to it everywhere so this
// provider stays strictly within the free tier.
const MODEL = "gemini-3.5-flash-lite";

/** One prompt in, one parsed JSON object out -- callers validate the shape. */
export async function generateJsonWithGemini(prompt: string): Promise<unknown> {
  return extractJson(await completeWithGemini(prompt, MODEL, 0.2));
}

export async function generateWithGemini(prompt: string): Promise<HoroscopeSections> {
  const parsed = extractJson(await completeWithGemini(prompt, MODEL, 0.8));

  return {
    overall: parsed.overall,
    love: parsed.love,
    career: parsed.career,
    money: parsed.money,
    energy: parsed.energy,
    luckyTheme: parsed.luckyTheme,
    focus: parsed.focus,
    motivation: parsed.motivation,
    disclaimer: DISCLAIMER,
  };
}
