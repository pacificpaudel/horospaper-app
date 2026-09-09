import { HoroscopeSections } from "./types";

const DISCLAIMER = "Astrology is provided for entertainment and personal reflection.";

function extractJson(text: string): Record<string, string> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("LLM response did not contain a JSON object");
  return JSON.parse(match[0]);
}

export async function generateWithOpenAI(prompt: string): Promise<HoroscopeSections> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  const text = data.choices[0]?.message?.content ?? "";
  const parsed = extractJson(text);

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
