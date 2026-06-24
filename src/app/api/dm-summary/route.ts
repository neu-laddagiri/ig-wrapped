import { NextResponse } from "next/server";
import type {
  DmAiSummaryResult,
  DmAiSummaryTone,
  DmSummaryApiRequest,
} from "@/types/dmAiSummary";

const SYSTEM_PROMPT = `You are writing an Instagram Wrapped-style DM recap for one specific chat. Sound like a funny, sharp friend who actually read the messages — not a therapist, not a corporate analyst, not ChatGPT.

Your job: make this recap feel like it could ONLY describe THIS chat.

VOICE:
- Funny, specific, punchy, culturally aware (memes, reels, group chat chaos, late-night texts).
- Use "this chat gives…", "the vibe is…", "based on the receipts…" energy.
- Light roasting is encouraged. Playful savage > polite vagueness.
- Gen Z aware without forced slang or cringe.
- Short sentences. No filler. No over-explaining.

BANNED (never write these vibes):
- Corporate/therapy speak: "mix of connection and communication", "healthy dynamic", "open dialogue", "mutual respect", "navigate", "hold space", "it's clear that both parties…"
- Generic AI fluff that could describe any chat.
- Long quotes from private messages.
- Serious accusations, cruelty, slurs, hate toward protected traits.
- Sexual content involving minors.
- Medical/legal/mental health diagnoses.
- Doxxing or revealing addresses, phone numbers, emails, real names.
- Claiming certainty about relationships, intentions, or cheating.

SPECIFICITY RULES (critical):
- Reference concrete patterns from the sample: who texts more, reel/link spam, one-word replies, planning vs chaos, double-texting, ghosting arcs, emoji energy, time gaps, repeated phrases/topics.
- Cite stats when useful (message counts, most active month, media/links).
- signaturePatterns: 3-5 bullets, each about a DISTINCT behavior seen in the sample — not generic traits.
- whoCarries: name the anonymized sender label + their % of messages + a funny read on what they contribute.
- roast: the star section — 2-4 sentences, the funniest/most savage (but safe) take on the whole dynamic.
- wrappedAward: format as "Award Name — one-sentence reason tied to this chat".
- confidenceNote: one short line, self-aware, not a disclaimer essay.

Return ONLY valid JSON with exactly these keys:
chatVibe (1 punchy sentence),
oneSentenceSummary (1 strong sentence — the headline),
whoCarries,
signaturePatterns (array of 3-5 strings),
funniestDynamic,
roast,
greenFlags (array of 2-4 strings),
redFlags (array of 2-4 playful strings),
wrappedAward,
confidenceNote`;

const TONE_GUIDANCE: Record<Exclude<DmAiSummaryTone, "funny">, string> = {
  wrapped: `TONE: Wrapped (default). Year-end awards show energy. Punchy labels, funny superlatives, stat callbacks. Balanced humor — roast AND celebrate. Think Spotify Wrapped narrator meets group chat lore.`,
  savage: `TONE: Savage. Sharper roast. More bite, more jokes at the dynamic (not at people as human beings). Playful phrases welcome: "this chat needs a project manager", "emotional support side quest", "planning committee from hell", "reel dealer with a texting addiction". Still safe — no cruelty, no protected-trait jokes, no serious accusations.`,
  real: `TONE: Real. Less jokes, more honest dynamic analysis. Still casual and specific — never corporate. Call out the actual power balance, effort gap, and communication style with receipts.`,
  wholesome: `TONE: Wholesome. Warm, positive, friendship-forward. Highlight care, consistency, inside jokes, loyalty, and green flags. Still fun and specific — not saccharine or generic.`,
};

const MAX_SELECTED_MESSAGES = 100;
const MAX_MESSAGE_TEXT = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidTone(tone: unknown): tone is DmAiSummaryTone {
  return (
    tone === "real" ||
    tone === "funny" ||
    tone === "savage" ||
    tone === "wrapped" ||
    tone === "wholesome"
  );
}

function resolveTone(tone: DmAiSummaryTone): Exclude<DmAiSummaryTone, "funny"> {
  if (tone === "funny") return "wrapped";
  return tone;
}

function validateRequest(body: unknown): DmSummaryApiRequest | string {
  if (!isRecord(body)) return "Invalid request body.";

  const threadTitle =
    typeof body.threadTitle === "string" ? body.threadTitle.slice(0, 200) : "";
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
      const sender =
        typeof m.sender === "string" ? m.sender.slice(0, 40) : "User";
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
      photoCount: typeof stats.photoCount === "number" ? stats.photoCount : 0,
      videoCount: typeof stats.videoCount === "number" ? stats.videoCount : 0,
      audioCount: typeof stats.audioCount === "number" ? stats.audioCount : 0,
      reactionCount:
        typeof stats.reactionCount === "number" ? stats.reactionCount : 0,
      callCount: typeof stats.callCount === "number" ? stats.callCount : 0,
      averageMessageLength:
        typeof stats.averageMessageLength === "number"
          ? stats.averageMessageLength
          : undefined,
      firstMessageAt:
        typeof stats.firstMessageAt === "string"
          ? stats.firstMessageAt.slice(0, 30)
          : undefined,
      lastMessageAt:
        typeof stats.lastMessageAt === "string"
          ? stats.lastMessageAt.slice(0, 30)
          : undefined,
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
      typeof parsed[k] === "string" ? (parsed[k] as string).trim() : "";
    const arr = (k: string) =>
      Array.isArray(parsed[k])
        ? (parsed[k] as unknown[])
            .filter((v) => typeof v === "string")
            .map((v) => (v as string).trim().slice(0, 400))
            .filter(Boolean)
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

function formatSenderBreakdown(
  messagesBySender: Record<string, number>,
  totalMessages: number
): string {
  const entries = Object.entries(messagesBySender).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "unknown";
  return entries
    .map(([name, count]) => {
      const pct =
        totalMessages > 0 ? Math.round((count / totalMessages) * 100) : 0;
      return `${name}: ${count} msgs (${pct}%)`;
    })
    .join("; ");
}

function buildUserPrompt(req: DmSummaryApiRequest): string {
  const tone = resolveTone(req.tone);
  const sortedSample = [...req.selectedMessages].sort(
    (a, b) => a.timestamp_ms - b.timestamp_ms
  );

  const sample = sortedSample
    .map((m, i) => {
      const date = new Date(m.timestamp_ms).toISOString().slice(0, 16);
      return `${i + 1}. [${m.sender}] ${date}: ${m.text}`;
    })
    .join("\n");

  const chatType = req.isGroup
    ? `group chat (${req.participantCount} people)`
    : req.participantCount <= 2
      ? "1:1 or two-person thread"
      : `small group (${req.participantCount} people)`;

  return `${TONE_GUIDANCE[tone]}

THREAD CONTEXT (use anonymized labels only — never invent real names):
- Label: ${req.threadTitle}
- Type: ${chatType}
- Participant count: ${req.participantCount}

HARD STATS (weave these into your recap):
- Total messages: ${req.stats.totalMessages}
- Messages by sender: ${formatSenderBreakdown(req.stats.messagesBySender, req.stats.totalMessages)}
- First message: ${req.stats.firstMessageAt ?? "unknown"}
- Last active: ${req.stats.lastMessageAt ?? "unknown"}
- Most active month: ${req.stats.mostActiveMonth ?? "unknown"}
- Links shared: ${req.stats.linkCount}
- Reels/posts shared: ${req.stats.reelOrPostCount}
- Photos: ${req.stats.photoCount} | Videos: ${req.stats.videoCount} | Audio: ${req.stats.audioCount}
- Total media: ${req.stats.mediaCount}
- Reactions: ${req.stats.reactionCount}
- Calls: ${req.stats.callCount}
- Avg message length: ${req.stats.averageMessageLength != null ? `${req.stats.averageMessageLength} chars` : "unknown"}

MESSAGE SAMPLE (${sortedSample.length} messages, chronological, anonymized, truncated):
${sample}

FINAL INSTRUCTIONS:
- Avoid generic statements. Every section must feel unique to THIS chat.
- Reference concrete repeated patterns from the sample above.
- Do not quote messages longer than a short phrase.
- Make the roast the funniest section.
- Return JSON only.`;

}

function temperatureForTone(tone: DmAiSummaryTone): number {
  const resolved = resolveTone(tone);
  if (resolved === "savage") return 0.95;
  if (resolved === "wrapped") return 0.9;
  if (resolved === "wholesome") return 0.8;
  return 0.75;
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
        temperature: temperatureForTone(validated.tone),
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
