import {
  formatAccountDisplayName,
  isInstagramPlaceholderName,
  pickBestDisplayName,
  UNKNOWN_ACCOUNT_LABEL,
} from "@/lib/accountNameFilter";
import {
  getCanonicalAccountKey,
  isLikelyInstagramUsername,
  normalizeUsername as canonicalNormalizeUsername,
  rawFolderSegment,
  usernameFromFolderPath,
} from "@/lib/accountIdentity";
import {
  inferAccountOwnerKeys,
  normalizeIdentityKey,
  type DmMatchStatus,
  type MatchMethod,
} from "@/lib/identityResolver";
import {
  isExportOwnerName,
  type ExportOwnerIdentity,
} from "@/lib/exportOwnerIdentity";
import {
  isDirectDmThread,
  normalizeDmThreadList,
  type NormalizedDmThread,
} from "@/lib/dmThreads";
import type { DmAnalytics, NetworkStats } from "@/types/instagram";
import type { NameConfidence } from "@/types/insights";

export interface DmPersonRecord {
  key: string;
  stableKey: string;
  displayName: string;
  username: string;
  directDmCount: number;
  directDmSentByMe: number;
  directDmSentByThem: number;
  firstDmAt?: number;
  lastDmAt?: number;
  threadIds: string[];
  threadTitles: string[];
  matchMethod: MatchMethod;
  matchConfidence: NameConfidence;
  dmMatchStatus: DmMatchStatus;
  isUnknownOrDeleted: boolean;
  messageBalance?: number;
  senderSplitAvailable: boolean;
  senderSplitConfidence: NameConfidence;
  folderSlugs?: string[];
  mostActiveMonth?: string;
}

export interface GroupSenderRecord {
  key: string;
  stableKey: string;
  displayName: string;
  username: string;
  messagesSent: number;
  isUnknownOrDeleted: boolean;
}

export interface CoreAnalyticsDebugRow {
  rank: number;
  name: string;
  username?: string;
  messageCount: number;
  matchMethod?: string;
  threadTitle?: string;
}

export interface ScoreBreakdownRow {
  name: string;
  username: string;
  score: number;
  breakdown: string;
}

export interface CoreAnalytics {
  directDmThreads: NormalizedDmThread[];
  groupDmThreads: NormalizedDmThread[];
  dmPeople: DmPersonRecord[];
  dmPeopleByKey: Map<string, DmPersonRecord>;
  groupSenders: GroupSenderRecord[];
  topDirectDmPeople: DmPersonRecord[];
  topGroupChatParticipants: GroupSenderRecord[];
  ownerIdentity: ExportOwnerIdentity;
  debug: {
    directDmThreadCount: number;
    groupDmThreadCount: number;
    topDirectDmThreads: CoreAnalyticsDebugRow[];
    topDmPeople: CoreAnalyticsDebugRow[];
  };
}

function folderDisplaySlug(path?: string): string | null {
  const raw = rawFolderSegment(path);
  if (!raw) return null;
  return raw.replace(/_/g, " ").trim();
}

function countSentByOther(
  thread: NormalizedDmThread,
  owner: ExportOwnerIdentity
): {
  me: number;
  them: number;
  splitAvailable: boolean;
} {
  if (owner.confidence === "low" || owner.keys.size === 0) {
    return { me: 0, them: 0, splitAvailable: false };
  }
  let me = 0;
  let them = 0;
  for (const [sender, count] of Object.entries(thread.messagesBySender ?? {})) {
    if (isExportOwnerName(sender, owner)) me += count;
    else them += count;
  }
  return { me, them, splitAvailable: true };
}

function messageBalance(thread: NormalizedDmThread): number | undefined {
  const counts = Object.values(thread.messagesBySender ?? {});
  if (counts.length < 2 || thread.totalMessages <= 0) return undefined;
  const sorted = [...counts].sort((a, b) => b - a);
  return 1 - Math.abs(sorted[0] - sorted[1]) / thread.totalMessages;
}

function inferOtherParticipant(
  thread: NormalizedDmThread,
  owner: ExportOwnerIdentity
): { name: string; method: MatchMethod; confidence: NameConfidence } | null {
  const candidates: { name: string; method: MatchMethod }[] = [];

  const folderRaw = rawFolderSegment(thread.sourcePath);
  if (folderRaw) candidates.push({ name: folderRaw, method: "folder-path" });

  for (const p of thread.participants ?? []) {
    if (!isExportOwnerName(p, owner)) {
      candidates.push({ name: p, method: "participant-name" });
    }
  }
  for (const sender of Object.keys(thread.messagesBySender ?? {})) {
    if (!isExportOwnerName(sender, owner)) {
      candidates.push({ name: sender, method: "sender-name" });
    }
  }
  if (thread.title && !thread.isGroup && !thread.title.startsWith("Group chat")) {
    if (!isExportOwnerName(thread.title, owner)) {
      candidates.push({ name: thread.title, method: "thread-title" });
    }
  }

  const names = candidates.map((c) => c.name);
  const best = pickBestDisplayName(names) ?? names[0];
  if (!best?.trim()) return null;

  const method =
    candidates.find(
      (c) => normalizeIdentityKey(c.name) === normalizeIdentityKey(best)
    )?.method ?? "thread-title";

  const confidence: NameConfidence =
    method === "folder-path" || method === "exact-username"
      ? "high"
      : method === "thread-title" || method === "display-name"
        ? "medium"
        : "high";

  return { name: best.trim(), method, confidence };
}

function resolveDirectThreadIdentity(
  thread: NormalizedDmThread,
  owner: ExportOwnerIdentity,
  network: NetworkStats | null
): {
  canonicalKey: string;
  username: string;
  displayName: string;
  matchMethod: MatchMethod;
  matchConfidence: NameConfidence;
  isUnknown: boolean;
} | null {
  const folderUser = usernameFromFolderPath(thread.sourcePath);
  const other = inferOtherParticipant(thread, owner);

  if (folderUser) {
    const display =
      other && !isInstagramPlaceholderName(other.name)
        ? formatAccountDisplayName(other.name)
        : folderUser;
    return {
      canonicalKey: folderUser,
      username: folderUser,
      displayName: display,
      matchMethod: "folder-path",
      matchConfidence: "high",
      isUnknown: false,
    };
  }

  if (!other) return null;

  const isUnknown = isInstagramPlaceholderName(other.name);

  if (isLikelyInstagramUsername(other.name)) {
    const user = canonicalNormalizeUsername(other.name);
    return {
      canonicalKey: user,
      username: user,
      displayName: isUnknown
        ? UNKNOWN_ACCOUNT_LABEL
        : formatAccountDisplayName(other.name),
      matchMethod: other.method,
      matchConfidence: "high",
      isUnknown,
    };
  }

  if (network) {
    const normOther = canonicalNormalizeUsername(other.name);
    const all = [
      ...network.followers,
      ...network.following,
      ...network.mutuals,
    ];
    for (const acc of all) {
      const netUser = canonicalNormalizeUsername(acc.username);
      if (netUser === normOther) {
        return {
          canonicalKey: netUser,
          username: netUser,
          displayName: formatAccountDisplayName(
            acc.displayUsername || other.name
          ),
          matchMethod: "exact-username",
          matchConfidence: "high",
          isUnknown: false,
        };
      }
    }
  }

  const canonicalKey = getCanonicalAccountKey({
    folderPath: thread.sourcePath,
    threadId: thread.id,
  });

  return {
    canonicalKey,
    username: canonicalKey,
    displayName: isUnknown
      ? UNKNOWN_ACCOUNT_LABEL
      : formatAccountDisplayName(other.name),
    matchMethod: other.method,
    matchConfidence: other.confidence,
    isUnknown,
  };
}

function resolveGroupSenderIdentity(
  sender: string,
  threadId: string,
  network: NetworkStats | null
): {
  canonicalKey: string;
  username: string;
  displayName: string;
  isUnknown: boolean;
} {
  const isUnknown = isInstagramPlaceholderName(sender);

  if (isLikelyInstagramUsername(sender)) {
    const user = canonicalNormalizeUsername(sender);
    return {
      canonicalKey: user,
      username: user,
      displayName: isUnknown
        ? UNKNOWN_ACCOUNT_LABEL
        : formatAccountDisplayName(sender),
      isUnknown,
    };
  }

  if (network) {
    const norm = canonicalNormalizeUsername(sender);
    const all = [
      ...network.followers,
      ...network.following,
      ...network.mutuals,
    ];
    for (const acc of all) {
      const netUser = canonicalNormalizeUsername(acc.username);
      if (netUser === norm) {
        return {
          canonicalKey: netUser,
          username: netUser,
          displayName: formatAccountDisplayName(
            acc.displayUsername || sender
          ),
          isUnknown: false,
        };
      }
    }
  }

  const senderKey = normalizeIdentityKey(sender);
  const canonicalKey = `group:${threadId}:${senderKey}`;
  return {
    canonicalKey,
    username: canonicalKey,
    displayName: isUnknown
      ? UNKNOWN_ACCOUNT_LABEL
      : formatAccountDisplayName(sender),
    isUnknown,
  };
}

function mergeDmPerson(
  existing: DmPersonRecord,
  incoming: Omit<DmPersonRecord, "key" | "stableKey">
): DmPersonRecord {
  const splitAvailable =
    existing.senderSplitAvailable && incoming.senderSplitAvailable;
  return {
    ...existing,
    displayName:
      pickBestDisplayName([incoming.displayName, existing.displayName]) ??
      existing.displayName,
    directDmCount: existing.directDmCount + incoming.directDmCount,
    directDmSentByMe: splitAvailable
      ? existing.directDmSentByMe + incoming.directDmSentByMe
      : 0,
    directDmSentByThem: splitAvailable
      ? existing.directDmSentByThem + incoming.directDmSentByThem
      : 0,
    firstDmAt:
      existing.firstDmAt !== undefined && incoming.firstDmAt !== undefined
        ? Math.min(existing.firstDmAt, incoming.firstDmAt)
        : existing.firstDmAt ?? incoming.firstDmAt,
    lastDmAt:
      incoming.lastDmAt !== undefined
        ? Math.max(existing.lastDmAt ?? 0, incoming.lastDmAt)
        : existing.lastDmAt,
    threadIds: [...new Set([...existing.threadIds, ...incoming.threadIds])],
    threadTitles: [
      ...new Set([...existing.threadTitles, ...incoming.threadTitles]),
    ],
    folderSlugs: [
      ...new Set([
        ...(existing.folderSlugs ?? []),
        ...(incoming.folderSlugs ?? []),
      ]),
    ],
    mostActiveMonth: incoming.mostActiveMonth ?? existing.mostActiveMonth,
    matchMethod:
      existing.matchConfidence === "high"
        ? existing.matchMethod
        : incoming.matchMethod,
    matchConfidence:
      existing.matchConfidence === "high"
        ? existing.matchConfidence
        : incoming.matchConfidence,
    dmMatchStatus:
      existing.dmMatchStatus === "matched" ||
      incoming.dmMatchStatus === "matched"
        ? "matched"
        : existing.dmMatchStatus === "possible" ||
            incoming.dmMatchStatus === "possible"
          ? "possible"
          : "matched",
    messageBalance:
      existing.messageBalance !== undefined &&
      incoming.messageBalance !== undefined
        ? Math.max(existing.messageBalance, incoming.messageBalance)
        : existing.messageBalance ?? incoming.messageBalance,
    senderSplitAvailable: splitAvailable,
    senderSplitConfidence: splitAvailable
      ? existing.senderSplitConfidence
      : "low",
  };
}

export function buildCoreAnalytics(params: {
  messages: DmAnalytics | null;
  network: NetworkStats | null;
  files?: Map<string, string>;
}): CoreAnalytics {
  const { messages, network, files } = params;
  const normalized = normalizeDmThreadList(messages);
  const ownerIdentity = inferAccountOwnerKeys(network, messages, files);

  const directDmThreads = normalized.filter((t) => isDirectDmThread(t));
  const groupDmThreads = normalized.filter((t) => !isDirectDmThread(t));

  const dmPeopleByKey = new Map<string, DmPersonRecord>();
  const groupByKey = new Map<string, GroupSenderRecord>();

  for (const thread of directDmThreads) {
    const identity = resolveDirectThreadIdentity(
      thread,
      ownerIdentity,
      network
    );
    if (!identity) continue;

    const { canonicalKey, username, displayName, matchMethod, matchConfidence, isUnknown } =
      identity;

    const sent = countSentByOther(thread, ownerIdentity);
    const balance = messageBalance(thread);
    const folderSlug = folderDisplaySlug(thread.sourcePath);

    const incoming: DmPersonRecord = {
      key: canonicalKey,
      stableKey: canonicalKey,
      displayName,
      username,
      directDmCount: thread.totalMessages,
      directDmSentByMe: sent.splitAvailable ? sent.me : 0,
      directDmSentByThem: sent.splitAvailable ? sent.them : 0,
      firstDmAt: thread.firstMessageAt,
      lastDmAt: thread.lastMessageAt,
      mostActiveMonth: thread.mostActiveMonth,
      threadIds: [thread.id],
      threadTitles: [formatAccountDisplayName(thread.title)],
      folderSlugs: folderSlug ? [folderSlug] : [],
      matchMethod,
      matchConfidence,
      dmMatchStatus: matchConfidence === "medium" ? "possible" : "matched",
      isUnknownOrDeleted: isUnknown,
      messageBalance: balance,
      senderSplitAvailable: sent.splitAvailable,
      senderSplitConfidence: ownerIdentity.confidence,
    };

    const existing = dmPeopleByKey.get(canonicalKey);
    if (existing) {
      dmPeopleByKey.set(canonicalKey, mergeDmPerson(existing, incoming));
    } else {
      dmPeopleByKey.set(canonicalKey, incoming);
    }
  }

  for (const thread of groupDmThreads) {
    for (const [sender, count] of Object.entries(thread.messagesBySender ?? {})) {
      if (!count || isExportOwnerName(sender, ownerIdentity)) continue;

      const identity = resolveGroupSenderIdentity(sender, thread.id, network);
      const existing = groupByKey.get(identity.canonicalKey);
      if (existing) {
        existing.messagesSent += count;
      } else {
        groupByKey.set(identity.canonicalKey, {
          key: identity.canonicalKey,
          stableKey: identity.canonicalKey,
          displayName: identity.displayName,
          username: identity.username,
          messagesSent: count,
          isUnknownOrDeleted: identity.isUnknown,
        });
      }
    }
  }

  const dmPeople = [...dmPeopleByKey.values()].sort(
    (a, b) => b.directDmCount - a.directDmCount
  );
  const groupSenders = [...groupByKey.values()].sort(
    (a, b) => b.messagesSent - a.messagesSent
  );

  const topDirectDmThreads: CoreAnalyticsDebugRow[] = [...directDmThreads]
    .sort((a, b) => b.totalMessages - a.totalMessages)
    .slice(0, 20)
    .map((t, i) => ({
      rank: i + 1,
      name: formatAccountDisplayName(t.title),
      messageCount: t.totalMessages,
      threadTitle: formatAccountDisplayName(t.title),
    }));

  const topDmPeople: CoreAnalyticsDebugRow[] = dmPeople
    .slice(0, 20)
    .map((p, i) => ({
      rank: i + 1,
      name: p.displayName,
      username: p.username.startsWith("dm:") ? undefined : p.username,
      messageCount: p.directDmCount,
      matchMethod: p.matchMethod,
      threadTitle: p.threadTitles[0],
    }));

  return {
    directDmThreads,
    groupDmThreads,
    dmPeople,
    dmPeopleByKey,
    groupSenders,
    topDirectDmPeople: dmPeople.slice(0, 50),
    topGroupChatParticipants: groupSenders.slice(0, 50),
    ownerIdentity,
    debug: {
      directDmThreadCount: directDmThreads.length,
      groupDmThreadCount: groupDmThreads.length,
      topDirectDmThreads,
      topDmPeople,
    },
  };
}
