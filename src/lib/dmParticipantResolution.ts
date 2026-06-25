import { normalizeUsername } from "@/lib/formatters";
import {
  isInstagramPlaceholderName,
  isValidAccountName,
  pickBestDisplayName,
} from "@/lib/accountNameFilter";
import type { DmAnalytics, DmThreadAnalytics, NetworkStats } from "@/types/instagram";
import type { AccountSourceBreakdown, DmThreadDebugEntry, NameConfidence } from "@/types/insights";

export interface DmAccountStats {
  directDmCount: number;
  groupMessagesSent: number;
  groupChatsShared: number;
  hasDirectThread: boolean;
  lastDirectDmAt?: number;
  directThreadIds: string[];
  displayName: string;
  confidence: NameConfidence;
  isUnknown: boolean;
  sources: string[];
}

function normalizeKey(name: string): string {
  return name.trim().replace(/^@/, "").toLowerCase();
}

function slugFromPath(path?: string): string | null {
  if (!path) return null;
  const parts = path.replace(/\\/g, "/").split("/");
  const inboxIdx = parts.findIndex(
    (p) => p === "inbox" || p === "message_requests"
  );
  if (inboxIdx < 0 || !parts[inboxIdx + 1]) return null;
  const slug = parts[inboxIdx + 1].replace(/_/g, " ").trim();
  if (!slug || isInstagramPlaceholderName(slug)) return null;
  if (isValidAccountName(slug)) return slug;
  return null;
}

/** Collect likely account-owner sender keys from export + network. */
export function inferAccountOwnerKeys(
  network: NetworkStats | null,
  messages: DmAnalytics | null
): Set<string> {
  const keys = new Set<string>();

  if (network) {
    for (const acc of network.followers) {
      keys.add(normalizeKey(acc.username));
      if (acc.displayUsername) keys.add(normalizeKey(acc.displayUsername));
    }
  }

  if (messages?.threads) {
    const senderTotals = new Map<string, number>();
    for (const t of messages.threads) {
      for (const [sender, count] of Object.entries(t.messagesBySender ?? {})) {
        senderTotals.set(sender, (senderTotals.get(sender) ?? 0) + count);
      }
    }
    const top = [...senderTotals.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] > 20) keys.add(normalizeKey(top[0]));
  }

  return keys;
}

function isOwnerName(name: string, ownerKeys: Set<string>): boolean {
  const k = normalizeKey(name);
  return ownerKeys.has(k);
}

export function buildParticipantLookup(
  network: NetworkStats
): Map<string, string> {
  const lookup = new Map<string, string>();
  const lists = [
    ...network.followers,
    ...network.following,
    ...network.mutuals,
    ...network.dontFollowMeBack,
    ...network.iDontFollowBack,
    ...network.pendingRequests,
    ...network.recentFollowRequests,
    ...network.recentlyUnfollowed,
    ...network.blocked,
    ...network.restricted,
  ];

  for (const acc of lists) {
    const username = normalizeUsername(acc.username);
    if (!isValidAccountName(username)) continue;
    lookup.set(username, username);
    if (acc.displayUsername) {
      const dk = normalizeKey(acc.displayUsername);
      if (dk) lookup.set(dk, username);
    }
  }
  return lookup;
}

function resolveToNetworkUsername(
  name: string,
  lookup: Map<string, string>,
  networkUsernames: Set<string>
): string | null {
  const key = normalizeKey(name);
  if (!key) return null;
  if (lookup.has(key)) return lookup.get(key)!;
  if (networkUsernames.has(key) && isValidAccountName(key)) return key;
  return null;
}

function isDirectThread(thread: DmThreadAnalytics): boolean {
  if (thread.isGroupChat) return false;
  const senderCount = Object.keys(thread.messagesBySender ?? {}).length;
  if (thread.participantCount > 2) return false;
  if (senderCount > 3) return false;
  return true;
}

interface OtherIdentity {
  key: string;
  displayName: string;
  confidence: NameConfidence;
  isUnknown: boolean;
  sources: string[];
}

function resolveOtherInDirectThread(
  thread: DmThreadAnalytics,
  ownerKeys: Set<string>,
  lookup: Map<string, string>,
  networkUsernames: Set<string>,
  unknownIndex: number
): OtherIdentity {
  const candidates: string[] = [];
  const sources: string[] = [];

  for (const p of thread.participants) {
    if (!isOwnerName(p, ownerKeys)) candidates.push(p);
  }
  for (const sender of Object.keys(thread.messagesBySender ?? {})) {
    if (!isOwnerName(sender, ownerKeys)) candidates.push(sender);
  }
  if (thread.threadName) candidates.push(thread.threadName);
  if (thread.title) candidates.push(thread.title);
  const slug = slugFromPath(thread.sourcePath ?? thread.threadPath);
  if (slug) candidates.push(slug);

  const best = pickBestDisplayName(candidates);
  const networkUser = best
    ? resolveToNetworkUsername(best, lookup, networkUsernames)
    : null;

  if (networkUser) {
    if (thread.participants.some((p) => normalizeKey(p) === normalizeKey(best!)))
      sources.push("Direct 1-on-1 DM thread");
    return {
      key: networkUser,
      displayName: best!,
      confidence: "high",
      isUnknown: false,
      sources: sources.length ? sources : ["Direct 1-on-1 DM thread"],
    };
  }

  const fallback = pickBestDisplayName([
    ...candidates,
    slugFromPath(thread.sourcePath),
  ]);

  if (fallback && isValidAccountName(fallback)) {
    const key = normalizeUsername(fallback);
    return {
      key,
      displayName: fallback,
      confidence: "medium",
      isUnknown: false,
      sources: ["Direct 1-on-1 DM thread (name not in followers/following)"],
    };
  }

  const idx = unknownIndex + 1;
  return {
    key: `unknown:${thread.id}`,
    displayName: `Unknown account #${idx}`,
    confidence: "low",
    isUnknown: true,
    sources: ["Unknown/deleted account from Instagram export"],
  };
}

function emptyStats(partial: Partial<DmAccountStats> = {}): DmAccountStats {
  return {
    directDmCount: 0,
    groupMessagesSent: 0,
    groupChatsShared: 0,
    hasDirectThread: false,
    directThreadIds: [],
    displayName: "",
    confidence: "low",
    isUnknown: false,
    sources: [],
    ...partial,
  };
}

function bumpStats(
  map: Map<string, DmAccountStats>,
  key: string,
  patch: Partial<DmAccountStats> & { displayName?: string }
): void {
  const existing = map.get(key) ?? emptyStats({ displayName: patch.displayName ?? key });
  map.set(key, {
    ...existing,
    displayName: patch.displayName ?? existing.displayName,
    confidence:
      patch.confidence === "high" || existing.confidence === "high"
        ? "high"
        : patch.confidence === "medium" || existing.confidence === "medium"
          ? "medium"
          : existing.confidence,
    isUnknown: existing.isUnknown || Boolean(patch.isUnknown),
    directDmCount: existing.directDmCount + (patch.directDmCount ?? 0),
    groupMessagesSent:
      existing.groupMessagesSent + (patch.groupMessagesSent ?? 0),
    groupChatsShared:
      existing.groupChatsShared + (patch.groupChatsShared ?? 0),
    hasDirectThread: existing.hasDirectThread || Boolean(patch.hasDirectThread),
    lastDirectDmAt:
      patch.lastDirectDmAt !== undefined
        ? Math.max(existing.lastDirectDmAt ?? 0, patch.lastDirectDmAt)
        : existing.lastDirectDmAt,
    directThreadIds: [
      ...existing.directThreadIds,
      ...(patch.directThreadIds ?? []),
    ],
    sources: [...new Set([...existing.sources, ...(patch.sources ?? [])])],
  });
}

export function buildDmStatsAndDebug(params: {
  messages: DmAnalytics | null;
  network: NetworkStats | null;
}): {
  statsByKey: Map<string, DmAccountStats>;
  threadDebug: DmThreadDebugEntry[];
} {
  const { messages, network } = params;
  const map = new Map<string, DmAccountStats>();
  const threadDebug: DmThreadDebugEntry[] = [];

  if (!messages) return { statsByKey: map, threadDebug };

  const ownerKeys = inferAccountOwnerKeys(network, messages);
  const lookup = network ? buildParticipantLookup(network) : new Map();
  const networkUsernames = new Set(lookup.values());
  let unknownCounter = 0;

  for (const thread of messages.threads ?? []) {
    const senders = thread.messagesBySender ?? {};
    const direct = isDirectThread(thread);

    if (direct) {
      const other = resolveOtherInDirectThread(
        thread,
        ownerKeys,
        lookup,
        networkUsernames,
        unknownCounter
      );
      if (other.isUnknown) unknownCounter++;

      bumpStats(map, other.key, {
        displayName: other.displayName,
        confidence: other.confidence,
        isUnknown: other.isUnknown,
        directDmCount: thread.messageCount,
        hasDirectThread: true,
        lastDirectDmAt: thread.lastMessageTimestamp,
        directThreadIds: [thread.id],
        sources: other.sources,
      });

      threadDebug.push({
        threadId: thread.id,
        title: thread.threadName,
        sourcePath: thread.sourcePath,
        participantCount: thread.participantCount,
        isGroup: false,
        totalMessages: thread.messageCount,
        senderCounts: { ...senders },
        inferredOtherParticipant: other.displayName,
        contributesToDirectLeaderboard: true,
        contributesToGroupLeaderboard: false,
        nameConfidence: other.confidence,
        isUnknownAccount: other.isUnknown,
      });
      continue;
    }

    if (!thread.isGroupChat) continue;

    bumpStats(map, `__group__:${thread.id}`, {
      displayName: thread.threadName,
      groupChatsShared: 1,
      sources: ["Group chat thread"],
    });

    for (const [sender, count] of Object.entries(senders)) {
      if (!count || isOwnerName(sender, ownerKeys)) continue;
      const networkUser = resolveToNetworkUsername(
        sender,
        lookup,
        networkUsernames
      );
      if (networkUser) {
        bumpStats(map, networkUser, {
          displayName: sender,
          confidence: "high",
          groupMessagesSent: count,
          sources: ["Actual sender in group chat"],
        });
      }
    }

    threadDebug.push({
      threadId: thread.id,
      title: thread.threadName,
      sourcePath: thread.sourcePath,
      participantCount: thread.participantCount,
      isGroup: true,
      totalMessages: thread.messageCount,
      senderCounts: { ...senders },
      inferredOtherParticipant: undefined,
      contributesToDirectLeaderboard: false,
      contributesToGroupLeaderboard: true,
      nameConfidence: "medium",
      isUnknownAccount: false,
    });
  }

  return { statsByKey: map, threadDebug };
}

export function toSourceBreakdown(
  stats: DmAccountStats,
  account: {
    isMutual: boolean;
    followsMe: boolean;
    iFollowThem: boolean;
    likedCount: number;
    commentedCount: number;
    storyInteractionCount: number;
  }
): AccountSourceBreakdown {
  const explanations: string[] = [...stats.sources];
  if (account.isMutual && stats.directDmCount === 0 && stats.groupMessagesSent === 0) {
    explanations.push("Mutual follow only");
  }
  if (account.likedCount > 0) explanations.push("Extracted from likes export");
  if (account.commentedCount > 0) explanations.push("Extracted from comments export");

  let confidence: NameConfidence = stats.confidence;
  if (stats.isUnknown) confidence = "low";
  else if (stats.directDmCount > 50 || account.likedCount > 10) confidence = "high";
  else if (stats.directDmCount > 0 || stats.groupMessagesSent > 0) confidence = "medium";

  return {
    directDmMessages: stats.directDmCount,
    groupMessagesSent: stats.groupMessagesSent,
    groupChatsShared: stats.groupChatsShared,
    isMutual: account.isMutual,
    followsMe: account.followsMe,
    iFollowThem: account.iFollowThem,
    likedCount: account.likedCount,
    commentedCount: account.commentedCount,
    storyInteractionCount: account.storyInteractionCount,
    lastDirectDmAt: stats.lastDirectDmAt,
    confidence,
    explanations,
    isUnknownAccount: stats.isUnknown,
  };
}
