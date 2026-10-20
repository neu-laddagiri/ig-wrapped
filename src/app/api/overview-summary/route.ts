import { NextResponse } from "next/server";
import type {
  OverviewAiSummaryResult,
  OverviewAiTone,
} from "@/types/overviewAiSummary";
import {
  callChatCompletion,
  guardAiRequest,
  isAiConfigured,
  isRecord,
  jsonError,
  sanitizeMetrics,
} from "@/lib/aiRouteGuard";

export const maxDuration = 30;

// Generous enough for "thinking" models, which count reasoning toward this cap.
const MAX_OUTPUT_TOKENS = 8192;
const MAX_FIELD_CHARS = 1000;

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
  metrics: Record<string, string | number>
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
      typeof parsed[k] === "string"
        ? (parsed[k] as string).trim().slice(0, MAX_FIELD_CHARS)
        : "";
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
  return NextResponse.json({ configured: isAiConfigured() });
}

export async function POST(request: Request) {
  const guard = await guardAiRequest(request, {
    route: "overview-summary",
    perMinute: 6,
    perHour: 30,
  });
  if (!guard.ok) return guard.response;

  const body = guard.body;
  if (!isRecord(body) || !isValidTone(body.tone)) {
    return jsonError("Invalid tone.", 400);
  }
  const tone = body.tone;

  const metrics = sanitizeMetrics(body.metrics);
  if (typeof metrics === "string") return jsonError(metrics, 400);

  try {
    const result = await callChatCompletion(guard.config, "overview-summary", {
      temperature: tone === "drama" ? 0.95 : 0.88,
      maxTokens: MAX_OUTPUT_TOKENS,
      json: true,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(tone, metrics) },
      ],
    });
    if (!result.ok) return jsonError(result.error, result.status);

    const summary = parseResult(result.content, tone);
    if (!summary) {
      return jsonError("Could not parse AI response. Try again.", 502);
    }

    return NextResponse.json({ summary });
  } catch {
    return jsonError("Failed to generate recap. Try again later.", 500);
  }
}
