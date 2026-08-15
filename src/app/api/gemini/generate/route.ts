import { redactSecret } from "@/lib/errors";

// Server-only proxy for Gemini calls. Keeps the API key out of the client
// bundle — callers on this route never see GEMINI_API_KEY.
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"] as const;

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

export async function POST(request: Request): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { prompt?: unknown } | null;
  const prompt = body?.prompt;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }

  const payloads = [
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    },
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1 },
    },
    { contents: [{ parts: [{ text: prompt }] }] },
  ] as const;

  let last400Error = "";

  for (const model of GEMINI_MODELS) {
    for (const payload of payloads) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (response.status === 429) {
        return Response.json({ error: "rate_limit" }, { status: 429 });
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        if (response.status === 400) {
          last400Error = redactSecret(errorBody);
          continue;
        }
        return Response.json(
          { error: `Gemini API error ${response.status}: ${redactSecret(errorBody)}` },
          { status: 502 }
        );
      }

      const data = (await response.json()) as GeminiResponse;
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content?.trim()) return Response.json({ text: content });
    }
  }

  if (last400Error) {
    return Response.json({ error: `Gemini API error 400: ${last400Error}` }, { status: 502 });
  }
  return Response.json({ error: "Empty response from Gemini API" }, { status: 502 });
}
