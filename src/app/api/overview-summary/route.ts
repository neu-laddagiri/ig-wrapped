import { NextResponse } from "next/server";
import type {
  OverviewAiSummaryResult,
  OverviewAiTone,
} from "@/types/overviewAiSummary";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isValidTone(tone: unknown): tone is OverviewAiTone {
  return (
    tone === "wrapped" ||
    tone === "real" ||
    tone === "savage" ||
    tone === "drama"
  );
}

const TONE_GUIDANCE: Record<OverviewAiTone, string> = {
  wrapped:
    "TONE: Wrapped. Fun year-end recap energy, dramatic but warm, screenshot-worthy.",
  real: "TONE: Real. Honest, perceptive, fewer jokes, never corporate.",
  savage:
    "TONE: Savage. Playful roast energy about patterns — never cruel or accusatory.",
  drama:
    "TONE: Drama. Maximum tea energy about social patterns — still privacy-safe.",
};

function buildSystemPrompt(): string {
  return `You write an Instagram Wrapped-style OVERALL recap from aggregate metrics only — no raw DMs, no search terms, no private names.

Be entertaining, specific to the numbers provided, and privacy-safe. Do not invent people or conversations.

Return ONLY valid JSON with keys:
overallVibe, whatInstagramSays, strongestPattern, funniestCallout, privacyRecommendation, wrappedAward`;
}

function buildUserPrompt(
  tone: OverviewAiTone,
  metrics: Record<string, string | number | null>
): string {
  const lines = Object.entries(metrics)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  return `${TONE_GUIDANCE[tone]}

METRICS (from official Instagram export — aggregated only):
${lines}

Write a full-account recap. Reference actual numbers. No raw private content. JSON only.`;
}

function parseResult(content: string, tone: OverviewAiTone): OverviewAiSummaryResult | null {
  const trimmed = content.trim();
  const json =
    trimmed.startsWith("{")
      ? trimmed
      : trimmed.match(/\{[\s\S]*\}/)?.[0] ?? trimmed;

  try {
    const parsed = JSON.parse(json);
    if (!isRecord(parsed)) return null;
    const str = (k: string) =>
      typeof parsed[k] === "string" ? (parsed[k] as string).trim() : "";
    const result: OverviewAiSummaryResult = {
      overallVibe: str("overallVibe"),
      whatInstagramSays: str("whatInstagramSays"),
      strongestPattern: str("strongestPattern"),
      funniestCallout: str("funniestCallout"),
      privacyRecommendation: str("privacyRecommendation"),
      wrappedAward: str("wrappedAward"),
      tone,
      generatedAt: new Date().toISOString(),
    };
    if (result.overallVibe || result.whatInstagramSays) return result;
  } catch {
    return null;
  }
  return null;
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
      { error: "AI summaries are not configured yet." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body) || !isValidTone(body.tone)) {
    return NextResponse.json({ error: "Invalid tone." }, { status: 400 });
  }

  if (!isRecord(body.metrics)) {
    return NextResponse.json({ error: "Missing metrics." }, { status: 400 });
  }

  const metrics: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(body.metrics)) {
    if (typeof v === "string" || typeof v === "number" || v === null) {
      metrics[k] = v;
    }
  }

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
        temperature: body.tone === "drama" ? 0.95 : 0.88,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(body.tone, metrics) },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return NextResponse.json(
        { error: "The AI provider returned an error. Try again later." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "AI returned an empty response." },
        { status: 502 }
      );
    }

    const summary = parseResult(content, body.tone);
    if (!summary) {
      return NextResponse.json(
        { error: "Could not parse AI response. Try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate recap. Try again later." },
      { status: 500 }
    );
  }
}
