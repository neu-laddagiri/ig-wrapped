import {
  formatAccountDisplayName,
  isInstagramPlaceholderName,
  pickBestDisplayName,
  UNKNOWN_ACCOUNT_LABEL,
} from "@/lib/accountNameFilter";
import {
  buildNetworkUsernameIndex,
  folderSlugFromPath,
  getCanonicalAccountKey,
  isSyntheticCanonicalKey,
  resolveUsernameCandidate,
  usernameFromFolderPath,
  type NetworkUsernameIndex,
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
  const slug = folderSlugFromPath(path);
  if (!slug) return null;
  return slug.replace(/_/g, " ").trim();
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
  // A friend with the owner's exact display name is indistinguishable from the owner.
  const participants = thread.participants ?? [];
  if (participants.length > 0 && participants.every((p) => isExportOwnerName(p, owner))) {
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

interface NameCandidate {
  name: string;
  method: MatchMethod;
}

/** Non-owner names for a 1:1 thread, best display source first; the folder slug is a last resort. */
function otherParticipantCandidates(
  thread: NormalizedDmThread,
  owner?: ExportOwnerIdentity
): NameCandidate[] {
  const out: NameCandidate[] = [];
  const isOwner = (name: string) => Boolean(owner && isExportOwnerName(name, owner));

  for (const p of thread.participants ?? []) {
    if (!isOwner(p)) out.push({ name: p, method: "participant-name" });
  }
  for (const sender of Object.keys(thread.messagesBySender ?? {})) {
    if (!isOwner(sender)) out.push({ name: sender, method: "sender-name" });
  }
  if (thread.title && !thread.isGroup && !thread.title.startsWith("Group chat")) {
    if (!isOwner(thread.title)) out.push({ name: thread.title, method: "thread-title" });
  }
  const folderSlug = folderSlugFromPath(thread.sourcePath);
  if (folderSlug) out.push({ name: folderSlug, method: "folder-path" });
  return out;
}

function inferOtherParticipant(
  thread: NormalizedDmThread,
  owner?: ExportOwnerIdentity
): { name: string; method: MatchMethod; confidence: NameConfidence } | null {
  const candidates = otherParticipantCandidates(thread, owner);
  const best = pickBestDisplayName(candidates.map((c) => c.name)) ?? candidates[0]?.name;
  if (!best?.trim()) return null;

  const bestKey = normalizeIdentityKey(best);
  const method =
    candidates.find((c) => normalizeIdentityKey(c.name) === bestKey)?.method ??
    "thread-title";
  const confidence: NameConfidence =
    method === "participant-name" || method === "sender-name" ? "high" : "medium";

  return { name: best.trim(), method, confidence };
}

export interface DirectThreadAccount {
  canonicalKey: string;
  /** Network/handle username, or the synthetic key when none could be verified. */
  username: string;
  /** True when `username` is a real Instagram handle (safe for @labels and profile links). */
  hasHandle: boolean;
  displayName: string;
  matchMethod: MatchMethod;
  matchConfidence: NameConfidence;
  isUnknown: boolean;
}

/**
 * Account for a 1:1 thread. Instagram DMs carry display names only, so a username is
 * accepted from the folder slug or a participant name only when it matches the network
 * export (or is unmistakably a handle); everything else is a DM-only `thread:` account.
 * Shared by core analytics and the direct DM index so both tabs agree.
 */
export function resolveDirectThreadAccount(
  thread: NormalizedDmThread,
  owner: ExportOwnerIdentity | undefined,
  index: NetworkUsernameIndex | null
): DirectThreadAccount {
  const other = inferOtherParticipant(thread, owner);
  const isUnknown = other ? isInstagramPlaceholderName(other.name) : false;
  const displayFor = (fallback: string) =>
    other && !isUnknown
      ? formatAccountDisplayName(other.name)
      : isUnknown
        ? UNKNOWN_ACCOUNT_LABEL
        : formatAccountDisplayName(fallback);

  const folderUser = usernameFromFolderPath(thread.sourcePath, index);
  if (folderUser) {
    return {
      canonicalKey: folderUser,
      username: folderUser,
      hasHandle: true,
      displayName: displayFor(folderUser),
      matchMethod: "folder-path",
      matchConfidence: "high",
      isUnknown: false,
    };
  }

  for (const candidate of otherParticipantCandidates(thread, owner)) {
    if (candidate.method === "folder-path") continue;
    if (isInstagramPlaceholderName(candidate.name)) continue;
    const user = resolveUsernameCandidate(candidate.name, index);
    if (!user) continue;
    return {
      canonicalKey: user,
      username: user,
      hasHandle: true,
      displayName: displayFor(user),
      matchMethod: index?.exact.has(user) ? "exact-username" : candidate.method,
      matchConfidence: "high",
      isUnknown: false,
    };
  }

  const canonicalKey = getCanonicalAccountKey({ threadId: thread.id });
  return {
    canonicalKey,
    username: canonicalKey,
    hasHandle: false,
    displayName: displayFor(thread.title || UNKNOWN_ACCOUNT_LABEL),
    matchMethod: other?.method ?? "thread-title",
    matchConfidence: other?.confidence ?? "low",
    isUnknown,
  };
}

function resolveGroupSenderIdentity(
  sender: string,
  threadId: string,
  index: NetworkUsernameIndex | null
): {
  canonicalKey: string;
  username: string;
  displayName: string;
  isUnknown: boolean;
} {
  const isUnknown = isInstagramPlaceholderName(sender);

  const user = isUnknown ? null : resolveUsernameCandidate(sender, index);
  if (user) {
    return {
      canonicalKey: user,
      username: user,
      displayName: formatAccountDisplayName(sender),
      isUnknown: false,
    };
  }

  const senderKey = normalizeIdentityKey(sender);
  // Same name across chats = one person; deleted "Instagram User"s stay per thread.
  const canonicalKey = isUnknown
    ? `group:${threadId}:${senderKey}`
    : `group:${senderKey}`;
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
  const networkIndex = buildNetworkUsernameIndex(network);

  const directDmThreads = normalized.filter((t) => isDirectDmThread(t));
  const groupDmThreads = normalized.filter((t) => !isDirectDmThread(t));

  const dmPeopleByKey = new Map<string, DmPersonRecord>();
  const groupByKey = new Map<string, GroupSenderRecord>();

  for (const thread of directDmThreads) {
    const { canonicalKey, username, displayName, matchMethod, matchConfidence, isUnknown } =
      resolveDirectThreadAccount(thread, ownerIdentity, networkIndex);

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

  // A group sender with the same display name as a 1:1 partner who is already
  // linked to a network username is that person — otherwise they'd split into a
  // separate group persona and be credited with the same likes twice.
  const usernameByDisplayName = new Map<string, string | null>();
  for (const person of dmPeopleByKey.values()) {
    if (person.isUnknownOrDeleted || isSyntheticCanonicalKey(person.username)) continue;
    const nameKey = normalizeIdentityKey(person.displayName);
    if (!nameKey) continue;
    const known = usernameByDisplayName.get(nameKey);
    usernameByDisplayName.set(
      nameKey,
      known === undefined || known === person.username ? person.username : null
    );
  }

  for (const thread of groupDmThreads) {
    for (const [sender, count] of Object.entries(thread.messagesBySender ?? {})) {
      if (!count || isExportOwnerName(sender, ownerIdentity)) continue;

      const linkedUsername = usernameByDisplayName.get(normalizeIdentityKey(sender));
      const identity = linkedUsername
        ? {
            canonicalKey: linkedUsername,
            username: linkedUsername,
            displayName: formatAccountDisplayName(sender),
            isUnknown: false,
          }
        : resolveGroupSenderIdentity(sender, thread.id, networkIndex);
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
      username: isSyntheticCanonicalKey(p.username) ? undefined : p.username,
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
