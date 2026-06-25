import { formatMonthKey, parseTimestamp } from "@/lib/formatters";
import type { DmThreadAnalytics } from "@/types/instagram";
import type { DmAward, DmRelationshipInsight } from "@/types/insights";
import { normalizeDmThreadList, isDirectDmThread, normalizedThreadToAnalytics } from "@/lib/dmThreads";
import type { DmAnalytics } from "@/types/instagram";
import { formatDmThreadLabel } from "@/lib/dmDisplayLabels";

const MAX_REPLY_GAP_MS = 7 * 24 * 60 * 60 * 1000;
const LATE_NIGHT_START = 0;
const LATE_NIGHT_END = 5;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function median(nums: number[]): number | undefined {
  if (!nums.length) return undefined;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function analyzeThread(thread: DmThreadAnalytics): DmRelationshipInsight {
  const total = thread.messageCount || 1;
  const messageShareBySender: Record<string, number> = {};
  for (const [sender, count] of Object.entries(thread.messagesBySender)) {
    messageShareBySender[sender] = Math.round((count / total) * 100);
  }

  let avgReplyTimeMs: number | undefined;
  let medianReplyTimeMs: number | undefined;
  let longestGapMs: number | undefined;
  let mostActiveHour: number | undefined;
  let mostActiveDay: string | undefined;
  let lateNightCount = 0;

  const textMessages = thread.textMessages ?? [];
  if (textMessages.length > 1) {
    const sorted = [...textMessages].sort(
      (a, b) => a.timestamp_ms - b.timestamp_ms
    );
    const replyTimes: number[] = [];
    const hourCounts = new Map<number, number>();
    const dayCounts = new Map<string, number>();

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (prev.sender_name !== curr.sender_name) {
        const gap = curr.timestamp_ms - prev.timestamp_ms;
        if (gap > 0 && gap <= MAX_REPLY_GAP_MS) replyTimes.push(gap);
      }
      const ts = parseTimestamp(curr.timestamp_ms);
      if (ts) {
        const d = new Date(ts * 1000);
        const hour = d.getUTCHours();
        hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
        const day = DAY_NAMES[d.getUTCDay()];
        dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
        if (hour >= LATE_NIGHT_START && hour <= LATE_NIGHT_END) lateNightCount++;
      }
    }

    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].timestamp_ms - sorted[i - 1].timestamp_ms;
      if (!longestGapMs || gap > longestGapMs) longestGapMs = gap;
    }

    if (replyTimes.length) {
      avgReplyTimeMs =
        replyTimes.reduce((a, b) => a + b, 0) / replyTimes.length;
      medianReplyTimeMs = median(replyTimes);
    }

    mostActiveHour = [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    mostActiveDay = [...dayCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  }

  return {
    threadId: thread.id,
    threadTitle: thread.threadName,
    isGroup: thread.isGroupChat,
    participantCount: thread.participantCount,
    messageShareBySender,
    firstMessageSender: thread.firstMessageSender,
    lastMessageSender: thread.lastMessageSender,
    avgReplyTimeMs,
    medianReplyTimeMs,
    longestGapMs,
    mostActiveHour,
    mostActiveDay,
    lateNightCount,
    mostActiveMonth: thread.mostActiveMonth,
  };
}

function balanceScore(thread: DmThreadAnalytics): number {
  const counts = Object.values(thread.messagesBySender);
  if (counts.length < 2) return 0;
  const total = thread.messageCount;
  const sorted = [...counts].sort((a, b) => b - a);
  return 1 - Math.abs(sorted[0] - sorted[1]) / Math.max(total, 1);
}

function oneSidedScore(thread: DmThreadAnalytics): number {
  const counts = Object.values(thread.messagesBySender);
  if (!counts.length) return 0;
  return Math.max(...counts) / Math.max(thread.messageCount, 1);
}

export function computeDmRelationshipInsights(
  messages: DmAnalytics | null
): { insights: DmRelationshipInsight[]; awards: DmAward[] } {
  const normalized = normalizeDmThreadList(messages);
  if (!normalized.length) return { insights: [], awards: [] };

  const threads = normalized.map(normalizedThreadToAnalytics);
  const directThreads = normalized.filter(isDirectDmThread).map(normalizedThreadToAnalytics);
  const insights = threads.map(analyzeThread);
  const awards: DmAward[] = [];

  const labelFor = (threadId: string) => {
    const thread = threads.find((t) => t.id === threadId);
    return thread ? formatDmThreadLabel(thread) : "Direct thread";
  };

  const biggest = [...directThreads].sort((a, b) => b.messageCount - a.messageCount)[0];
  if (biggest) {
    awards.push({
      id: "biggest-yapper",
      title: "Biggest Yapper",
      threadId: biggest.id,
      threadLabel: formatDmThreadLabel(biggest),
      description: `${biggest.messageCount.toLocaleString()} messages`,
    });
  }

  const withReply = insights.filter((i) => {
    const thread = threads.find((t) => t.id === i.threadId);
    return i.medianReplyTimeMs && thread && !thread.isGroupChat;
  });
  const fastest = [...withReply].sort(
    (a, b) => (a.medianReplyTimeMs ?? Infinity) - (b.medianReplyTimeMs ?? Infinity)
  )[0];
  if (fastest) {
    awards.push({
      id: "fastest-responder",
      title: "Fastest Responder",
      threadId: fastest.threadId,
      threadLabel: labelFor(fastest.threadId),
      description: `Median reply ~${Math.round((fastest.medianReplyTimeMs ?? 0) / 60000)} min`,
    });
  }

  const slowest = [...withReply].sort(
    (a, b) => (b.medianReplyTimeMs ?? 0) - (a.medianReplyTimeMs ?? 0)
  )[0];
  if (slowest && slowest.threadId !== fastest?.threadId) {
    awards.push({
      id: "slowest-responder",
      title: "Slowest Responder",
      threadId: slowest.threadId,
      threadLabel: labelFor(slowest.threadId),
      description: `Median reply ~${Math.round((slowest.medianReplyTimeMs ?? 0) / 3600000)} hr`,
    });
  }

  const oneSided = [...directThreads].sort(
    (a, b) => oneSidedScore(b) - oneSidedScore(a)
  )[0];
  if (oneSided) {
    awards.push({
      id: "one-sided",
      title: "Most One-Sided Chat",
      threadId: oneSided.id,
      threadLabel: labelFor(oneSided.id),
      description: "One person carries most messages",
    });
  }

  const balanced = [...directThreads].sort(
    (a, b) => balanceScore(b) - balanceScore(a)
  )[0];
  if (balanced) {
    awards.push({
      id: "balanced",
      title: "Most Balanced Chat",
      threadId: balanced.id,
      threadLabel: labelFor(balanced.id),
      description: "Even message split",
    });
  }

  const reels = [...directThreads].sort(
    (a, b) =>
      b.instagramReelLinks +
      b.instagramPostLinks -
      (a.instagramReelLinks + a.instagramPostLinks)
  )[0];
  if (reels && reels.instagramReelLinks + reels.instagramPostLinks > 0) {
    awards.push({
      id: "reels-dealer",
      title: "Reels Dealer",
      threadId: reels.id,
      threadLabel: labelFor(reels.id),
      description: `${reels.instagramReelLinks + reels.instagramPostLinks} links shared`,
    });
  }

  const lateNight = [...insights]
    .filter((i) => {
      const thread = threads.find((t) => t.id === i.threadId);
      return thread && !thread.isGroupChat;
    })
    .sort((a, b) => b.lateNightCount - a.lateNightCount)[0];
  if (lateNight?.lateNightCount) {
    awards.push({
      id: "late-night",
      title: "Late Night Menace",
      threadId: lateNight.threadId,
      threadLabel: labelFor(lateNight.threadId),
      description: `${lateNight.lateNightCount} late-night messages`,
    });
  }

  const oldest = directThreads
    .filter((t) => t.firstMessageTimestamp)
    .sort((a, b) => (a.firstMessageTimestamp ?? 0) - (b.firstMessageTimestamp ?? 0))[0];
  if (oldest) {
    awards.push({
      id: "longest-running",
      title: "Longest Running Chat",
      threadId: oldest.id,
      threadLabel: labelFor(oldest.id),
      description: "Oldest thread in your export",
    });
  }

  const group = [...threads]
    .filter((t) => t.isGroupChat)
    .sort((a, b) => b.messageCount - a.messageCount)[0];
  if (group) {
    awards.push({
      id: "group-chat",
      title: "Most Active Group Chat",
      threadId: group.id,
      threadLabel: labelFor(group.id),
      description: `${group.participantCount} people, ${group.messageCount.toLocaleString()} msgs`,
    });
  }

  return { insights, awards };
}
