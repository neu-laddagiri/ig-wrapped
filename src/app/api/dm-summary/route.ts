import { NextResponse } from "next/server";
import type {
  DmAiSummaryResult,
  DmAiSummaryTone,
  DmSummaryApiRequest,
} from "@/types/dmAiSummary";

function buildSystemPrompt(useRealNames: boolean): string {
  const nameRule = useRealNames
    ? `- Use participant names from the prompt naturally in whoCarries, patterns, roast, and awards. Do NOT use "User A", "User B", or "Person 1" when real names are provided.`
    : `- Use only anonymized sender labels from the sample (Person 1, Person 2, etc.). Never invent real names.`;

  return `You are writing an Instagram Wrapped-style DM recap. Be funny, dramatic, specific, and socially perceptive. Sound like a sharp friend reading the chat and saying what everyone is thinking — not a therapist, not corporate HR, not ChatGPT.

If the messages show flirting, romantic tension, situationship energy, mixed signals, jealousy jokes, late-night chaos, or "are they just friends?" vibes — call it out directly but playfully. Do not be sterile. Do not dodge the obvious. Do not sanitize flirty/romantic patterns into bland "friendship and communication."

If the message sample contains repeated flirty, romantic, or situationship-coded language, say the dynamic clearly using careful vibe-based wording (e.g. "the flirting is doing push-ups in the corner", "will-they-won't-they planning committee", "this would be obvious to everyone except the people in the chat").

RELATIONSHIP / FLIRTING LENS — infer from the sample which energies are present (mention only what the receipts support):
- Pure friendship vs group-chat chaos
- Flirty energy / romantic tension / situationship energy
- One-sided effort vs mutual effort / balanced chemistry
- Late-night chaos / party-nightlife logistics
- Planning-but-never-following-through energy
- Reels-only friendship / link-dumping with no real conversation
- Emotional support side quest
- Academic or social-life conflict / study-abroad romance subplot
- Mixed signals / "almost meeting up" energy
- Soft concern ("get home safe", checking in) that reads more than platonic

Look for: compliments, teasing, playful arguing, repeated hangout plans, missed connections, "where are you" / "come here" / "are you out", double-texting, inside jokes, romantic ambiguity.

VOICE:
- Funny, dramatic, punchy, screenshot-worthy, slightly messy in a fun way.
- Use "this chat gives…", "the vibe is…", "based on the receipts…" energy.
- Short sentences. No filler. No over-explaining.

NAME RULES:
${nameRule}

BANNED:
- Sterile dodge phrases: "mix of connection and communication", "healthy dynamic", "open dialogue", "mutual respect", "navigate", "hold space", "it's complicated" without specifics
- Generic fluff that could describe any chat
- Long quotes from private messages
- Serious accusations (cheating, abuse, etc.), cruelty, slurs, hate toward protected traits
- Medical/legal/mental health diagnoses
- Doxxing addresses, phone numbers, or emails
- Claiming certainty about what people "really" feel — use vibe-based language instead

OUTPUT STYLE (same JSON keys, dramatic content):
- chatVibe: 1 punchy sentence. Example energy: "Study abroad rom-com energy with a suspicious amount of 'where are you tonight?' logistics."
- oneSentenceSummary: 1 strong headline calling out the MAIN dynamic (flirtation subplot, logistics chaos, mutual chaos, etc.)
- whoCarries: cite message counts/%. If balanced, say chemistry/effort feels mutual. If one-sided, call it out with humor.
- signaturePatterns: 3-5 bullets — distinct repeated behaviors from the sample, including flirting/ambiguity if present
- funniestDynamic: genuinely funny read on the weird social rhythm of this chat
- roast: STRONGEST section — 2-4 sentences, funniest/most dramatic safe take. This is the screenshot line.
- greenFlags: 2-4 — care, check-ins, consistent replies, plans, safety messages, warmth
- redFlags: 2-4 PLAYFUL only — vague plans, late replies, mixed signals, one person carrying logistics, overthinking, "almost meeting up" energy. No serious accusations.
- wrappedAward: fun specific award + reason. Examples: "Most Likely To Turn Logistics Into A Flirtation Arc — …", "The Will-They-Won't-They Planning Committee Award — …"
- confidenceNote: 1 short self-aware line, not a disclaimer essay

Return ONLY valid JSON with keys:
chatVibe, oneSentenceSummary, whoCarries, signaturePatterns, funniestDynamic, roast, greenFlags, redFlags, wrappedAward, confidenceNote`;
}

const TONE_GUIDANCE: Record<Exclude<DmAiSummaryTone, "funny">, string> = {
  wrapped: `TONE: Wrapped. Fun, dramatic, screenshot-worthy, balanced. Year-end awards energy with stat callbacks. If flirting/tension is in the sample, name it — don't bury it under logistics.`,
  savage: `TONE: Savage. Roast-heavy, more direct about mixed signals and flirty tension. Example energy: "The flirting is doing push-ups in the corner while everyone pretends this is just logistics." Still playful and safe — no cruelty.`,
  real: `TONE: Real. Honest social analysis, fewer jokes, never corporate. Still mention flirting, romantic ambiguity, or one-sided effort if the receipts show it. Straight talk, not sterile.`,
  wholesome: `TONE: Wholesome. Warm, positive, green-flag forward. Can gently mention cute/flirty energy if present. Focus on care, consistency, memorable moments.`,
  drama: `TONE: Drama. Maximum tea energy. Focus on tension, ambiguity, flirting, chaotic planning, jealousy jokes, late-night arcs, and "everyone knows except them" energy. Most dramatic and socially aware — still safe, no serious accusations.`,
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
    tone === "wholesome" ||
    tone === "drama"
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
  const useRealNames = body.useRealNames === true;
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
        typeof m.sender === "string" ? m.sender.slice(0, 80) : "User";
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
          .map(([k, v]) => [String(k).slice(0, 80), v as number])
      )
    : {};

  const participants = Array.isArray(body.participants)
    ? body.participants
        .filter((p): p is string => typeof p === "string")
        .map((p) => p.slice(0, 80))
        .slice(0, 30)
    : undefined;

  return {
    threadTitle: threadTitle || "DM thread",
    participantCount,
    isGroup,
    useRealNames,
    participants,
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

function extractJsonBlock(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("{")) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);

  return trimmed;
}

function parseAiJson(content: string): DmAiSummaryResult | null {
  const candidates = [content, extractJsonBlock(content)];

  for (const raw of candidates) {
    try {
      const parsed = JSON.parse(raw);
      if (!isRecord(parsed)) continue;

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

      if (result.oneSentenceSummary || result.chatVibe) return result;
    } catch {
      continue;
    }
  }
  return null;
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

  const nameContext = req.useRealNames
    ? `PARTICIPANT NAMES (use these in your recap):
${req.participants?.length ? req.participants.join(", ") : "See sender labels in sample"}`
  : `SENDER LABELS: anonymized only (Person 1, Person 2, etc.) — do not invent real names.`;

  return `${TONE_GUIDANCE[tone]}

${nameContext}

THREAD:
- Title: ${req.threadTitle}
- Type: ${chatType}

STATS:
- Total messages: ${req.stats.totalMessages}
- By sender: ${formatSenderBreakdown(req.stats.messagesBySender, req.stats.totalMessages)}
- First message: ${req.stats.firstMessageAt ?? "unknown"}
- Last active: ${req.stats.lastMessageAt ?? "unknown"}
- Most active month: ${req.stats.mostActiveMonth ?? "unknown"}
- Links: ${req.stats.linkCount} | Reels/posts: ${req.stats.reelOrPostCount}
- Photos: ${req.stats.photoCount} | Videos: ${req.stats.videoCount} | Audio: ${req.stats.audioCount}
- Reactions: ${req.stats.reactionCount} | Calls: ${req.stats.callCount}
- Avg length: ${req.stats.averageMessageLength ?? "unknown"} chars

MESSAGE SAMPLE (${sortedSample.length} messages, chronological):
${sample}

FINAL INSTRUCTIONS:
- Be specific to THIS chat only — every section should feel unique to these receipts.
- If flirty/romantic/situationship patterns appear in the sample, name them. Do NOT default to generic friendship language.
- Make roast the most dramatic, screenshot-worthy section.
- Reference concrete repeated behaviors (compliments, late-night texts, plan chaos, teasing, concern, jealousy jokes, etc.) when present.
- Return JSON only.`;
}

function temperatureForTone(tone: DmAiSummaryTone): number {
  const resolved = resolveTone(tone);
  if (resolved === "drama") return 0.97;
  if (resolved === "savage") return 0.95;
  if (resolved === "wrapped") return 0.92;
  if (resolved === "wholesome") return 0.82;
  return 0.78;
}

function mapProviderError(status: number, errText: string): string {
  const lower = errText.toLowerCase();

  if (
    status === 429 ||
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("quota") ||
    lower.includes("resource exhausted") ||
    lower.includes("too many requests")
  ) {
    return "AI summary limit reached. Try again later or check your AI provider quota.";
  }

  if (status === 401 || (status === 403 && !lower.includes("quota"))) {
    return "AI authentication failed. Check AI_API_KEY on the server.";
  }

  if (
    status === 404 ||
    (lower.includes("model") && lower.includes("not found"))
  ) {
    return "AI model not found. Check AI_MODEL on the server.";
  }

  if (status >= 500) {
    return "The AI provider is temporarily unavailable. Try again in a few minutes.";
  }

  return "The AI provider returned an error. Try again in a moment.";
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
          {
            role: "system",
            content: buildSystemPrompt(validated.useRealNames),
          },
          { role: "user", content: buildUserPrompt(validated) },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(
        "[dm-summary] provider error",
        response.status,
        errText.slice(0, 800)
      );
      return NextResponse.json(
        { error: mapProviderError(response.status, errText) },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      console.error("[dm-summary] empty AI content", JSON.stringify(data).slice(0, 300));
      return NextResponse.json(
        { error: "AI returned an empty response. Try regenerating." },
        { status: 502 }
      );
    }

    const summary = parseAiJson(content);
    if (!summary) {
      console.error("[dm-summary] JSON parse failed", content.slice(0, 500));
      return NextResponse.json(
        {
          error:
            "The AI response could not be formatted. Try regenerating.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("[dm-summary] route error:", err);
    return NextResponse.json(
      { error: "Failed to generate summary. Try again later." },
      { status: 500 }
    );
  }
}
