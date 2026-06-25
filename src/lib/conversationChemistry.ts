import type { DmRelationshipInsight } from "@/types/insights";
import type { NormalizedDmThread } from "@/lib/dmThreads";

export interface ChemistryMetric {
  id: string;
  label: string;
  value: string;
  score: number;
  maxScore: number;
}

export interface ConversationChemistry {
  threadId: string;
  overallScore: number;
  confidence: "high" | "medium" | "low";
  metrics: ChemistryMetric[];
  disclaimer: string;
}

function clamp(n: number, min = 0, max = 100): number {
  return Math.round(Math.max(min, Math.min(max, n)));
}

export function computeConversationChemistry(
  thread: NormalizedDmThread,
  relationship?: DmRelationshipInsight
): ConversationChemistry | null {
  if (thread.isGroup) return null;

  const senders = Object.entries(thread.messagesBySender);
  if (!senders.length || thread.totalMessages < 3) return null;

  const sorted = [...senders].sort((a, b) => b[1] - a[1]);
  const topShare = sorted[0][1] / Math.max(thread.totalMessages, 1);
  const secondShare = (sorted[1]?.[1] ?? 0) / Math.max(thread.totalMessages, 1);
  const balance = 1 - Math.abs(topShare - secondShare);

  const reelsRatio =
    (thread.reelOrPostCount + thread.linkCount) /
    Math.max(thread.totalMessages, 1);
  const lateNight =
    (relationship?.lateNightCount ?? 0) / Math.max(thread.totalMessages, 1);
  const replyMs = relationship?.medianReplyTimeMs;
  const responseSpeed =
    replyMs == null
      ? 50
      : replyMs < 30 * 60 * 1000
        ? 85
        : replyMs < 4 * 60 * 60 * 1000
          ? 65
          : replyMs < 24 * 60 * 60 * 1000
            ? 45
            : 25;

  const longevity =
    thread.firstMessageAt && thread.lastMessageAt
      ? Math.min(
          100,
          ((thread.lastMessageAt - thread.firstMessageAt) /
            (365 * 24 * 60 * 60)) *
            40 +
            Math.log10(thread.totalMessages + 1) * 15
        )
      : Math.log10(thread.totalMessages + 1) * 20;

  const mainCharacter = topShare * 100;
  const ghostRisk = relationship?.longestGapMs
    ? Math.min(100, (relationship.longestGapMs / (30 * 24 * 60 * 60 * 1000)) * 35)
    : 30;

  const flirtEnergy = Math.min(
    100,
    (thread.reactionCount / Math.max(thread.totalMessages, 1)) * 200 +
      lateNight * 40
  );

  const hasText = (thread.textMessages?.length ?? 0) > 5;
  const confidence: "high" | "medium" | "low" = hasText
    ? "medium"
    : relationship
      ? "medium"
      : "low";

  const metrics: ChemistryMetric[] = [
    {
      id: "yap-balance",
      label: "Yap Balance",
      value: balance > 0.7 ? "Even split" : balance > 0.45 ? "Slightly one-sided" : "One person carries",
      score: clamp(balance * 100),
      maxScore: 100,
    },
    {
      id: "flirt",
      label: "Flirt Energy",
      value: flirtEnergy > 60 ? "High" : flirtEnergy > 30 ? "Medium" : "Low",
      score: clamp(flirtEnergy),
      maxScore: 100,
    },
    {
      id: "ghost",
      label: "Ghost Risk",
      value: ghostRisk > 65 ? "Watch the gaps" : ghostRisk > 35 ? "Some silence" : "Low",
      score: clamp(ghostRisk),
      maxScore: 100,
    },
    {
      id: "reels-ratio",
      label: "Reels-to-Text Ratio",
      value: reelsRatio > 0.25 ? "Link-heavy" : reelsRatio > 0.08 ? "Balanced mix" : "Mostly text",
      score: clamp(reelsRatio * 100),
      maxScore: 100,
    },
    {
      id: "response",
      label: "Response Speed",
      value:
        responseSpeed > 75 ? "Quick replies" : responseSpeed > 45 ? "Normal pace" : "Slow burn",
      score: clamp(responseSpeed),
      maxScore: 100,
    },
    {
      id: "late-night",
      label: "Late Night Ratio",
      value: lateNight > 0.2 ? "Night owl chat" : lateNight > 0.08 ? "Some late msgs" : "Daytime energy",
      score: clamp(lateNight * 100),
      maxScore: 100,
    },
    {
      id: "longevity",
      label: "Conversation Longevity",
      value: longevity > 70 ? "Long-running" : longevity > 40 ? "Established" : "Newer thread",
      score: clamp(longevity),
      maxScore: 100,
    },
    {
      id: "main-character",
      label: "Main Character Energy",
      value: mainCharacter > 70 ? "They carry" : mainCharacter > 55 ? "Shared stage" : "Balanced",
      score: clamp(mainCharacter),
      maxScore: 100,
    },
  ];

  const overallScore = clamp(
    metrics.reduce((s, m) => s + m.score, 0) / metrics.length
  );

  return {
    threadId: thread.id,
    overallScore,
    confidence,
    metrics,
    disclaimer:
      "For fun only — estimated from message metadata in your export, not a scientific relationship score.",
  };
}
