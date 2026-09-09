export async function generateWithOpenAIImage(prompt: string): Promise<Buffer> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1536", // closest supported portrait size to 4:5
      n: 1,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI image request failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { data: { b64_json: string }[] };
  const b64 = data.data[0]?.b64_json;
  if (!b64) throw new Error("OpenAI image response missing data");
  return Buffer.from(b64, "base64");
}
