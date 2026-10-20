import { NextResponse } from "next/server";
import {
  callChatCompletion,
  cleanText,
  guardAiRequest,
  isAiConfigured,
  isRecord,
  jsonError,
  sanitizeMetrics,
} from "@/lib/aiRouteGuard";

export const maxDuration = 30;

const MAX_QUESTION_CHARS = 1000;
const MAX_HISTORY_ITEMS = 6;
const MAX_HISTORY_CHARS = 1000;
// Generous enough for "thinking" models, which count reasoning toward this cap.
const MAX_OUTPUT_TOKENS = 8192;
const MAX_ANSWER_CHARS = 6000;

export async function GET() {
  return NextResponse.json({ configured: isAiConfigured() });
}

export async function POST(request: Request) {
  const guard = await guardAiRequest(request, {
    route: "analysis-chat",
    perMinute: 15,
    perHour: 120,
    notConfiguredMessage: "AI chat is not configured yet.",
  });
  if (!guard.ok) return guard.response;

  const body = guard.body;
  if (!isRecord(body) || typeof body.question !== "string") {
    return jsonError("Missing question.", 400);
  }
  const question = body.question.trim();
  if (!question) return jsonError("Missing question.", 400);
  if (question.length > MAX_QUESTION_CHARS) {
    return jsonError(
      `Question is too long (max ${MAX_QUESTION_CHARS.toLocaleString()} characters).`,
      400
    );
  }

  const metrics = body.metrics === undefined ? {} : sanitizeMetrics(body.metrics);
  if (typeof metrics === "string") return jsonError(metrics, 400);

  const history = Array.isArray(body.history) ? body.history : [];
  const historyLines = history
    .slice(-MAX_HISTORY_ITEMS)
    .filter(
      (h): h is { role: "user" | "assistant"; text: string } =>
        isRecord(h) &&
        (h.role === "user" || h.role === "assistant") &&
        typeof h.text === "string"
    )
    .map((h) => `${h.role}: ${cleanText(h.text, MAX_HISTORY_CHARS)}`)
    .join("\n");

  const metricLines = Object.entries(metrics)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const system = `You are a privacy-safe Instagram data analyst. Answer using ONLY the aggregated metrics provided. Do not invent private conversations, names, or search terms unless explicitly in metrics.
Never claim you unfollowed anyone or took actions. Be helpful, concise, and playful when appropriate.
If data is insufficient, say so clearly.`;

  const user = `METRICS (parsed export summary):
${metricLines}

Search history terms are never included — do not guess search terms.

${historyLines ? `PRIOR CHAT:\n${historyLines}\n` : ""}
USER QUESTION: ${question}

Answer in 2-5 short paragraphs. No JSON.`;

  try {
    const result = await callChatCompletion(guard.config, "analysis-chat", {
      temperature: 0.75,
      maxTokens: MAX_OUTPUT_TOKENS,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    if (!result.ok) return jsonError(result.error, result.status);

    return NextResponse.json({
      answer: result.content.trim().slice(0, MAX_ANSWER_CHARS),
    });
  } catch {
    return jsonError("Failed to generate answer. Try again later.", 500);
  }
}
