import { NextResponse } from "next/server";
import type {
  DmAiSummaryResult,
  DmAiSummaryTone,
  DmSummaryApiRequest,
} from "@/types/dmAiSummary";

const SYSTEM_PROMPT = `You are creating an Instagram Wrapped-style DM summary. Be funny, sharp, culturally aware, and honest. Avoid corporate language. Keep it playful but not cruel.

Rules:
- Do not quote long private messages verbatim.
- Do not reveal sensitive personal information (addresses, phone numbers, emails, full names).
- Do not make serious accusations.
- Do not use slurs or hate toward protected traits.
- No sexual content involving minors.
- No medical, legal, or mental health diagnoses.
- No doxxing.
- Do not claim certainty about relationships or intentions.
- Use phrases like "the vibe is," "based on the messages," and "this gives."

Return ONLY valid JSON with exactly these keys:
chatVibe, oneSentenceSummary, whoCarries, signaturePatterns (array of 2-4 strings), funniestDynamic, roast, greenFlags (array of 2-3 strings), redFlags (array of 2-3 strings), wrappedAward, confidenceNote`;

const TONE_GUIDANCE: Record<DmAiSummaryTone, string> = {
  real: "Tone: honest and grounded. Insightful but not mean.",
  funny: "Tone: witty and playful. Light jokes, meme-aware energy.",
  savage: "Tone: sharp roast energy. Edgy but never cruel or hateful.",
  wrapped: "Tone: Spotify Wrapped / IG Wrapped awards show energy. Punchy and celebratory.",
};

const MAX_SELECTED_MESSAGES = 100;
const MAX_MESSAGE_TEXT = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidTone(tone: unknown): tone is DmAiSummaryTone {
  return tone === "real" || tone === "funny" || tone === "savage" || tone === "wrapped";
}

function validateRequest(body: unknown): DmSummaryApiRequest | string {
  if (!isRecord(body)) return "Invalid request body.";

  const threadTitle = typeof body.threadTitle === "string" ? body.threadTitle.slice(0, 200) : "";
  const participantCount =
    typeof body.participantCount === "number" ? body.participantCount : 0;
  const isGroup = body.isGroup === true;
  const tone = body.tone;

  if (!isValidTone(tone)) return "Invalid tone.";

  if (!isRecord(body.stats)) return "Missing stats.";
  const stats = body.stats;
  const totalMessages =
    typeof stats.totalMessages === "number" ? stats.totalMessages : 0;

  if (!Array.isArray(body.selectedMessages)) return "Missing selectedMessages.";
  if (body.selectedMessages.length === 0) {
    return "No message sample available for this thread.";
  }

  const selectedMessages = body.selectedMessages
    .slice(0, MAX_SELECTED_MESSAGES)
    .map((m) => {
      if (!isRecord(m)) return null;
      const sender = typeof m.sender === "string" ? m.sender.slice(0, 40) : "User";
      const timestamp_ms =
        typeof m.timestamp_ms === "number" ? m.timestamp_ms : 0;
      const text =
        typeof m.text === "string" ? m.text.slice(0, MAX_MESSAGE_TEXT) : "";
      if (!text.trim()) return null;
      return { sender, timestamp_ms, text: text.trim() };
    })
    .filter((m): m is { sender: string; timestamp_ms: number; text: string } =>
      Boolean(m)
    );

  if (selectedMessages.length === 0) {
    return "No usable message text in sample.";
  }

  const messagesBySender = isRecord(stats.messagesBySender)
    ? Object.fromEntries(
        Object.entries(stats.messagesBySender)
          .filter(([, v]) => typeof v === "number")
          .slice(0, 20)
          .map(([k, v]) => [String(k).slice(0, 40), v as number])
      )
    : {};

  return {
    threadTitle: threadTitle || "DM thread",
    participantCount,
    isGroup,
    tone,
    stats: {
      totalMessages,
      linkCount: typeof stats.linkCount === "number" ? stats.linkCount : 0,
      reelOrPostCount:
        typeof stats.reelOrPostCount === "number" ? stats.reelOrPostCount : 0,
      mediaCount: typeof stats.mediaCount === "number" ? stats.mediaCount : 0,
      reactionCount:
        typeof stats.reactionCount === "number" ? stats.reactionCount : 0,
      callCount: typeof stats.callCount === "number" ? stats.callCount : 0,
      mostActiveMonth:
        typeof stats.mostActiveMonth === "string"
          ? stats.mostActiveMonth.slice(0, 10)
          : undefined,
      messagesBySender,
    },
    selectedMessages,
  };
}

function parseAiJson(content: string): DmAiSummaryResult | null {
  try {
    const parsed = JSON.parse(content);
    if (!isRecord(parsed)) return null;

    const str = (k: string) =>
      typeof parsed[k] === "string" ? (parsed[k] as string) : "";
    const arr = (k: string) =>
      Array.isArray(parsed[k])
        ? (parsed[k] as unknown[])
            .filter((v) => typeof v === "string")
            .map((v) => (v as string).slice(0, 300))
            .slice(0, 5)
        : [];

    const result: DmAiSummaryResult = {
      chatVibe: str("chatVibe"),
      oneSentenceSummary: str("oneSentenceSummary"),
      whoCarries: str("whoCarries"),
      signaturePatterns: arr("signaturePatterns"),
      funniestDynamic: str("funniestDynamic"),
      roast: str("roast"),
      greenFlags: arr("greenFlags"),
      redFlags: arr("redFlags"),
      wrappedAward: str("wrappedAward"),
      confidenceNote: str("confidenceNote"),
    };

    if (!result.oneSentenceSummary && !result.chatVibe) return null;
    return result;
  } catch {
    return null;
  }
}

function buildUserPrompt(req: DmSummaryApiRequest): string {
  const senderStats = Object.entries(req.stats.messagesBySender)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const sample = req.selectedMessages
    .map(
      (m) =>
        `[${m.sender}] ${new Date(m.timestamp_ms).toISOString().slice(0, 10)}: ${m.text}`
    )
    .join("\n");

  return `${TONE_GUIDANCE[req.tone]}

Thread: ${req.threadTitle}
Participants: ${req.participantCount} (${req.isGroup ? "group" : "1:1 or small"})

Stats:
- Total messages: ${req.stats.totalMessages}
- Links: ${req.stats.linkCount}
- Reels/posts shared: ${req.stats.reelOrPostCount}
- Media: ${req.stats.mediaCount}
- Reactions: ${req.stats.reactionCount}
- Calls: ${req.stats.callCount}
- Most active month: ${req.stats.mostActiveMonth ?? "unknown"}
- Messages by sender: ${senderStats || "unknown"}

Message sample (anonymized, truncated):
${sample}`;
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
      {
        error:
          "AI summaries are not configured yet. The site owner needs to set AI_API_KEY on the server.",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validated = validateRequest(body);
  if (typeof validated === "string") {
    return NextResponse.json({ error: validated }, { status: 400 });
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
        temperature: 0.85,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(validated) },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("AI provider error:", response.status, errText.slice(0, 500));
      return NextResponse.json(
        {
          error:
            "The AI provider returned an error. Check AI_API_KEY, AI_MODEL, and AI_BASE_URL.",
        },
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

    const summary = parseAiJson(content);
    if (!summary) {
      return NextResponse.json(
        { error: "Could not parse AI summary. Try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("dm-summary route error:", err);
    return NextResponse.json(
      { error: "Failed to generate summary. Try again later." },
      { status: 500 }
    );
  }
}
