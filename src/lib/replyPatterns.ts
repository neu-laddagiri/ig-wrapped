import type { DmAnalytics } from "@/types/instagram";
import type { ReplyPatternResult, ThreadReplyPattern } from "@/types/insights";
import { formatAccountDisplayName } from "@/lib/accountNameFilter";
import {
  isExportOwnerName,
  resolveExportOwnerIdentity,
  type ExportOwnerIdentity,
} from "@/lib/exportOwnerIdentity";

const MAX_REPLY_MS = 7 * 86400000;
/** A message after this much silence starts a new conversation. */
const CONVERSATION_GAP_MS = 6 * 3600000;
const OWNER_LABEL = "You";

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
  messages: DmAnalytics | null,
  ownerIdentity?: ExportOwnerIdentity
): ReplyPatternResult {
  const empty: ReplyPatternResult = {
    threads: [],
    available: false,
  };
  if (!messages?.threads?.length) return empty;

  const owner = ownerIdentity ?? resolveExportOwnerIdentity({ messages });
  // Without a known owner there is no "you" side to measure.
  if (owner.keys.size === 0) return empty;
  const meBySender = new Map<string, boolean>();
  const isMe = (name: string) => {
    let me = meBySender.get(name);
    if (me === undefined) {
      me = isExportOwnerName(name, owner);
      meBySender.set(name, me);
    }
    return me;
  };

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

    const countStart = (sender: string) => {
      if (isMe(sender)) startsYou++;
      else startsThem++;
    };
    const countEnd = (sender: string) => {
      if (isMe(sender)) lastYou++;
      else lastThem++;
    };

    countStart(samples[0].sender_name);
    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1];
      const s = samples[i];
      const gap = s.timestamp_ms - prev.timestamp_ms;
      const sameSide = isMe(s.sender_name) === isMe(prev.sender_name);
      if (!sameSide) {
        if (gap <= MAX_REPLY_MS) {
          if (isMe(s.sender_name)) youReplies.push(gap);
          else themReplies.push(gap);
        } else {
          ghostMax = Math.max(ghostMax, gap / 86400000);
        }
      }
      if (gap >= CONVERSATION_GAP_MS) {
        countEnd(prev.sender_name);
        countStart(s.sender_name);
      }
    }
    countEnd(samples[samples.length - 1].sender_name);

    const partner =
      thread.participants.find((p) => !isMe(p)) ?? thread.threadName;
    const partnerLabel = formatAccountDisplayName(partner);
    let youCount = 0;
    for (const [sender, count] of Object.entries(thread.messagesBySender ?? {})) {
      if (isMe(sender)) youCount += count;
    }
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

  // Responder awards are about the people you talk to, not you.
  const allResponders = threads.flatMap((t) =>
    t.avgReplyMsThem != null
      ? [{ label: t.partnerLabel, avgMs: t.avgReplyMsThem }]
      : []
  );

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
              ? OWNER_LABEL
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
              ? OWNER_LABEL
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
