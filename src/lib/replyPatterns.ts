import type { DmAnalytics } from "@/types/instagram";
import type { ReplyPatternResult, ThreadReplyPattern } from "@/types/insights";
import { formatAccountDisplayName } from "@/lib/accountNameFilter";

const MAX_REPLY_MS = 7 * 86400000;

function median(nums: number[]): number | undefined {
  if (!nums.length) return undefined;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function avg(nums: number[]): number | undefined {
  if (!nums.length) return undefined;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function computeReplyPatterns(
  messages: DmAnalytics | null
): ReplyPatternResult {
  const empty: ReplyPatternResult = {
    threads: [],
    available: false,
  };
  if (!messages?.threads?.length) return empty;

  const threads: ThreadReplyPattern[] = [];

  for (const thread of messages.threads) {
    if (thread.isGroupChat) continue;
    const samples = (thread.textMessages ?? [])
      .filter((m) => m.timestamp_ms)
      .sort((a, b) => (a.timestamp_ms ?? 0) - (b.timestamp_ms ?? 0));
    if (samples.length < 6) continue;

    const youReplies: number[] = [];
    const themReplies: number[] = [];
    let ghostMax = 0;
    let startsYou = 0;
    let startsThem = 0;
    let lastYou = 0;
    let lastThem = 0;

    let prevSender = samples[0].sender_name;
    let prevTs = samples[0].timestamp_ms!;
    if (prevSender === "You") startsYou++;
    else startsThem++;

    for (let i = 1; i < samples.length; i++) {
      const s = samples[i];
      const ts = s.timestamp_ms!;
      const gap = ts - prevTs;
      if (s.sender_name !== prevSender) {
        if (gap <= MAX_REPLY_MS) {
          if (s.sender_name === "You") youReplies.push(gap);
          else themReplies.push(gap);
        } else {
          ghostMax = Math.max(ghostMax, gap / 86400000);
        }
        if (samples[i - 1]?.sender_name !== s.sender_name) {
          if (s.sender_name === "You") startsYou++;
          else startsThem++;
        }
      }
      prevSender = s.sender_name;
      prevTs = ts;
    }

    const last = samples[samples.length - 1];
    if (last.sender_name === "You") lastYou = 1;
    else lastThem = 1;

    const partner =
      thread.participants.find((p) => p !== "You") ??
      thread.threadName;
    const partnerLabel = formatAccountDisplayName(partner);
    const youCount = thread.messagesBySender["You"] ?? 0;
    const themCount = thread.messageCount - youCount;
    const balance =
      thread.messageCount > 0
        ? 100 - Math.abs(50 - (youCount / thread.messageCount) * 100) * 2
        : 50;

    threads.push({
      threadId: thread.id,
      threadName: thread.threadName,
      partnerLabel,
      avgReplyMsYou: avg(youReplies),
      avgReplyMsThem: avg(themReplies),
      medianReplyMsYou: median(youReplies),
      medianReplyMsThem: median(themReplies),
      longestGhostGapDays: Math.round(ghostMax),
      conversationStartsYou: startsYou,
      conversationStartsThem: startsThem,
      lastMessagesYou: lastYou,
      lastMessagesThem: lastThem,
      responseBalanceScore: Math.round(balance),
      messageCount: thread.messageCount,
    });
  }

  if (!threads.length) return empty;

  const allResponders = threads.flatMap((t) => {
    const items: { label: string; avgMs: number }[] = [];
    if (t.avgReplyMsYou != null)
      items.push({ label: "You", avgMs: t.avgReplyMsYou });
    if (t.avgReplyMsThem != null)
      items.push({ label: t.partnerLabel, avgMs: t.avgReplyMsThem });
    return items;
  });

  const fastest = [...allResponders].sort((a, b) => a.avgMs - b.avgMs)[0];
  const slowest = [...allResponders].sort((a, b) => b.avgMs - a.avgMs)[0];
  const ghost = [...threads].sort(
    (a, b) => b.longestGhostGapDays - a.longestGhostGapDays
  )[0];
  const topStarterThread = [...threads].sort(
    (a, b) =>
      Math.max(b.conversationStartsYou, b.conversationStartsThem) -
      Math.max(a.conversationStartsYou, a.conversationStartsThem)
  )[0];
  const topEnderThread = [...threads].sort(
    (a, b) =>
      Math.max(b.lastMessagesYou, b.lastMessagesThem) -
      Math.max(a.lastMessagesYou, a.lastMessagesThem)
  )[0];

  return {
    threads,
    fastestResponder: fastest
      ? { label: fastest.label, avgMs: fastest.avgMs }
      : undefined,
    slowestResponder: slowest
      ? { label: slowest.label, avgMs: slowest.avgMs }
      : undefined,
    longestGhostGap: ghost
      ? { label: ghost.partnerLabel, days: ghost.longestGhostGapDays }
      : undefined,
    topStarter: topStarterThread
      ? {
          label:
            topStarterThread.conversationStartsYou >=
            topStarterThread.conversationStartsThem
              ? "You"
              : topStarterThread.partnerLabel,
          count: Math.max(
            topStarterThread.conversationStartsYou,
            topStarterThread.conversationStartsThem
          ),
        }
      : undefined,
    topEnder: topEnderThread
      ? {
          label:
            topEnderThread.lastMessagesYou >= topEnderThread.lastMessagesThem
              ? "You"
              : topEnderThread.partnerLabel,
          count: Math.max(
            topEnderThread.lastMessagesYou,
            topEnderThread.lastMessagesThem
          ),
        }
      : undefined,
    available: true,
  };
}
