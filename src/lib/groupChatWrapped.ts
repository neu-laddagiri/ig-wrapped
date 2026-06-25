import type { DmThreadAnalytics } from "@/types/instagram";
import type { GroupChatInsight, GroupChatRole } from "@/types/insights";
import { normalizeDmThreads } from "@/lib/dmThreads";
import type { DmAnalytics } from "@/types/instagram";

function assignRole(
  participant: string,
  count: number,
  total: number,
  maxCount: number,
  minCount: number,
  reels: number,
  isFirst?: boolean
): string {
  const share = count / Math.max(total, 1);
  if (count === maxCount && share > 0.35) return "Main character";
  if (count === minCount && share < 0.05) return "Ghost member";
  if (reels > 5) return "Link/reels dealer";
  if (isFirst) return "Conversation starter";
  if (share < 0.08) return "Lurker";
  if (share > 0.25 && share < 0.45) return "Chaos agent";
  return "Regular";
}

export function computeGroupChatInsights(
  messages: DmAnalytics | null
): GroupChatInsight[] {
  const threads = normalizeDmThreads(messages).filter((t) => t.isGroupChat);
  if (!threads.length) return [];

  return threads.map((thread) => buildGroupInsight(thread));
}

function buildGroupInsight(thread: DmThreadAnalytics): GroupChatInsight {
  const total = thread.messageCount || 1;
  const senders = Object.entries(thread.messagesBySender).sort(
    (a, b) => b[1] - a[1]
  );
  const maxCount = senders[0]?.[1] ?? 0;
  const minCount = senders[senders.length - 1]?.[1] ?? 0;
  const messageShare: Record<string, number> = {};
  const roles: GroupChatRole[] = [];

  for (const [participant, count] of senders) {
    const share = Math.round((count / total) * 100);
    messageShare[participant] = share;
    const reels =
      (thread.reelsLinksBySender[participant] ?? 0) +
      (thread.postLinksBySender[participant] ?? 0);
    roles.push({
      participant,
      role: assignRole(
        participant,
        count,
        total,
        maxCount,
        minCount,
        reels,
        participant === thread.firstMessageSender
      ),
      messageCount: count,
      messageShare: share,
    });
  }

  let lateNightCount = 0;
  for (const m of thread.textMessages ?? []) {
    const d = new Date(m.timestamp_ms);
    const hour = d.getUTCHours();
    if (hour >= 0 && hour <= 5) lateNightCount++;
  }

  return {
    threadId: thread.id,
    title: thread.threadName,
    participantCount: thread.participantCount,
    totalMessages: thread.messageCount,
    topSender: senders[0]?.[0],
    leastActive: senders[senders.length - 1]?.[0],
    messageShare,
    reelsShared: thread.instagramReelLinks + thread.instagramPostLinks,
    mediaCount: thread.photoCount + thread.videoCount + thread.audioCount,
    mostActiveMonth: thread.mostActiveMonth,
    lastActiveAt: thread.lastMessageTimestamp,
    lateNightCount,
    roles,
  };
}
