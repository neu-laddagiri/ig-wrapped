import { NextResponse } from "next/server";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.AI_API_KEY?.trim()),
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI chat is not configured yet." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body) || typeof body.question !== "string") {
    return NextResponse.json({ error: "Missing question." }, { status: 400 });
  }

  const metrics = isRecord(body.metrics) ? body.metrics : {};
  const includeSearch = Boolean(body.includeSearch);
  const history = Array.isArray(body.history) ? body.history : [];

  const metricLines = Object.entries(metrics)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const historyLines = history
    .filter((h) => isRecord(h) && typeof h.role === "string" && typeof h.text === "string")
    .slice(-6)
    .map((h) => `${h.role}: ${h.text}`)
    .join("\n");

  const system = `You are a privacy-safe Instagram data analyst. Answer using ONLY the aggregated metrics provided. Do not invent private conversations, names, or search terms unless explicitly in metrics.
Never claim you unfollowed anyone or took actions. Be helpful, concise, and playful when appropriate.
If data is insufficient, say so clearly.`;

  const user = `METRICS (parsed export summary):
${metricLines}

${includeSearch ? "Search history summary may be included in metrics if present." : "Search history is EXCLUDED — do not guess search terms."}

${historyLines ? `PRIOR CHAT:\n${historyLines}\n` : ""}
USER QUESTION: ${body.question.trim()}

Answer in 2-5 short paragraphs. No JSON.`;

  const baseUrl = (
    process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model = process.env.AI_MODEL?.trim() || "gpt-4o-mini";

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.75,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "The AI provider returned an error. Try again later." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "AI returned an empty response." },
        { status: 502 }
      );
    }

    return NextResponse.json({ answer: content.trim() });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate answer. Try again later." },
      { status: 500 }
    );
  }
}
