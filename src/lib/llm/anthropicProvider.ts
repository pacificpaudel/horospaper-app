import Anthropic from "@anthropic-ai/sdk";
import { HoroscopeSections } from "./types";

const DISCLAIMER = "Astrology is provided for entertainment and personal reflection.";

function extractJson(text: string): Record<string, string> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("LLM response did not contain a JSON object");
  return JSON.parse(match[0]);
}

async function completeWithAnthropic(prompt: string, maxTokens: number): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: maxTokens,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Request was declined by the model");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content returned from Anthropic");
  }
  return textBlock.text;
}

/** One prompt in, one parsed JSON object out -- callers validate the shape. */
export async function generateJsonWithAnthropic(prompt: string): Promise<unknown> {
  return extractJson(await completeWithAnthropic(prompt, 1000));
}

export async function generateWithAnthropic(prompt: string): Promise<HoroscopeSections> {
  const parsed = extractJson(await completeWithAnthropic(prompt, 2000));
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
