import { normalizeUsername } from "@/lib/formatters";
import {
  isInstagramPlaceholderName,
  pickBestDisplayName,
  formatAccountDisplayName,
  UNKNOWN_ACCOUNT_LABEL,
} from "@/lib/accountNameFilter";
import {
  isExportOwnerName,
  resolveExportOwnerIdentity,
  type ExportOwnerIdentity,
} from "@/lib/exportOwnerIdentity";
import type { DmAnalytics, DmThreadAnalytics, NetworkStats } from "@/types/instagram";
import type {
  AccountSourceBreakdown,
  DmThreadDebugEntry,
  NameConfidence,
} from "@/types/insights";
import {
  buildCoreAnalytics,
  type DmPersonRecord,
  type GroupSenderRecord,
} from "@/lib/insights/coreAnalytics";
import {
  resolveInteractionsForAliases,
  type InteractionExportMeta,
} from "@/lib/interactionExportParser";
import {
  isLikelyInstagramUsername,
  normalizeUsername as identityNormalizeUsername,
  usernamesMatch,
} from "@/lib/accountIdentity";

export type MatchMethod =
  | "exact-username"
  | "display-name"
  | "folder-path"
  | "participant-name"
  | "sender-name"
  | "thread-title"
  | "compact-fuzzy"
  | "unmatched";

export type DmMatchStatus = "matched" | "possible" | "none";

export type AttributionStatus =
  | "attributed"
  | "not_in_export"
  | "not_matched"
  | "not_account_level";

export interface DmInteractionMatch {
  status: DmMatchStatus;
  directDmCount: number;
  directDmSentByMe: number;
  directDmSentByThem: number;
  firstDmAt?: number;
  lastDmAt?: number;
  threadIds: string[];
  matchMethod?: MatchMethod;
  matchConfidence: NameConfidence;
  matchedThreadTitle?: string;
  sources: string[];
  senderSplitAvailable: boolean;
  senderSplitConfidence: NameConfidence;
}

export interface CanonicalPerson {
  canonicalId: string;
  username: string;
  displayName: string;
  normalizedUsername: string;
  aliases: string[];
  sourceRefs: string[];
  confidence: NameConfidence;
  isUnknownOrDeleted: boolean;
  followsMe: boolean;
  iFollowThem: boolean;
  isMutual: boolean;
  followedMeAt?: number;
  iFollowedAt?: number;
  dm: DmInteractionMatch;
  groupMessagesSent: number;
  groupChatsShared: number;
  likedCount: number;
  likesAttribution: AttributionStatus;
  commentedCount: number;
  commentsAttribution: AttributionStatus;
  storyInteractionCount: number;
  storiesAttribution: AttributionStatus;
  searchCount: number;
  searchAttribution: AttributionStatus;
}

export interface IdentityMatchDebugRow {
  resolvedName: string;
  username?: string;
  messageCount: number;
  matchMethod: MatchMethod;
  confidence: NameConfidence;
  threadTitle?: string;
}

export interface UnmatchedDmThreadRow {
  threadId: string;
  title: string;
  messageCount: number;
  participants: string[];
  folderSlug?: string;
}

export interface IdentityResolutionDebug {
  totalCanonicalPeople: number;
  networkOnlyPeople: number;
  directDmMatchedPeople: number;
  possibleDmMatches: number;
  unmatchedDmThreads: number;
  topMatches: IdentityMatchDebugRow[];
  topUnmatched: UnmatchedDmThreadRow[];
}

export interface IdentityGraph {
  persons: Map<string, CanonicalPerson>;
  aliasToCanonical: Map<string, string>;
  debug: IdentityResolutionDebug;
  coreAnalytics?: import("@/lib/insights/coreAnalytics").CoreAnalytics;
}

export function normalizeIdentityKey(name: string): string {
  return repairMojibake(name)
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function compactIdentityKey(name: string): string {
  return normalizeIdentityKey(name).replace(/[^a-z0-9]/g, "");
}

/** First meaningful name token for cross-format matching (belma_206 ↔ Belma ikanović). */
export function primaryNameToken(name: string): string {
  if (!name?.trim()) return "";
  const norm = normalizeIdentityKey(name).replace(/_/g, " ");
  const tokens = norm
    .split(/[\s.]+/)
    .filter((t) => t.length >= 2 && !/^\d{5,}$/.test(t));
  const first = tokens[0];
  if (!first) return compactIdentityKey(name);
  return compactIdentityKey(first);
}

function repairMojibake(text: string): string {
  if (!/Ã|Â|â€™|â€œ|â€/.test(text)) return text;
  try {
    const bytes = new Uint8Array([...text].map((c) => c.charCodeAt(0) & 0xff));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return text;
  }
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
  return slug;
}

export function inferAccountOwnerKeys(
  network: NetworkStats | null,
  messages: DmAnalytics | null,
  files?: Map<string, string>
): ExportOwnerIdentity {
  return resolveExportOwnerIdentity({ files, messages });
}

function isOwnerName(name: string, owner: ExportOwnerIdentity): boolean {
  return isExportOwnerName(name, owner);
}

function emptyDmMatch(): DmInteractionMatch {
  return {
    status: "none",
    directDmCount: 0,
    directDmSentByMe: 0,
    directDmSentByThem: 0,
    threadIds: [],
    matchConfidence: "low",
    sources: [],
    senderSplitAvailable: false,
    senderSplitConfidence: "low",
  };
}

function applyDmRecordToPerson(
  person: CanonicalPerson,
  record: DmPersonRecord
): void {
  person.dm.status =
    record.dmMatchStatus === "possible" ? "possible" : "matched";
  person.dm.directDmCount = record.directDmCount;
  person.dm.directDmSentByMe = record.directDmSentByMe;
  person.dm.directDmSentByThem = record.directDmSentByThem;
  person.dm.senderSplitAvailable = record.senderSplitAvailable;
  person.dm.senderSplitConfidence = record.senderSplitConfidence;
  person.dm.firstDmAt = record.firstDmAt;
  person.dm.lastDmAt = record.lastDmAt;
  person.dm.threadIds = [...record.threadIds];
  person.dm.matchMethod = record.matchMethod;
  person.dm.matchConfidence = record.matchConfidence;
  person.dm.matchedThreadTitle = record.threadTitles[0];
  person.dm.sources = record.threadTitles.map(
    (t) =>
      `DM thread "${t}" via ${record.matchMethod.replace(/-/g, " ")} (normalized)`
  );
  if (!person.sourceRefs.includes("Direct DM threads (normalized)")) {
    person.sourceRefs.push("Direct DM threads (normalized)");
  }
  mergePersonAliases(person, record.displayName, record.username, ...record.threadTitles);
  if (
    person.displayName === UNKNOWN_ACCOUNT_LABEL ||
    !person.displayName?.trim() ||
    person.displayName === person.username
  ) {
    const candidate = record.displayName;
    if (
      candidate &&
      candidate !== UNKNOWN_ACCOUNT_LABEL &&
      identityNormalizeUsername(candidate) !== identityNormalizeUsername(person.username)
    ) {
      person.displayName = formatAccountDisplayName(candidate);
    }
  }
}

function mergePersonAliases(
  person: CanonicalPerson,
  ...raw: string[]
): void {
  const set = new Set(person.aliases);
  for (const r of raw) {
    if (!r?.trim()) continue;
    set.add(r);
    const user = identityNormalizeUsername(r);
    if (isLikelyInstagramUsername(user)) set.add(user);
    const norm = normalizeIdentityKey(r);
    if (norm && norm !== user) set.add(norm);
  }
  person.aliases = [...set];
}

function finalizePersonDisplayName(person: CanonicalPerson): void {
  const best = pickBestDisplayName([
    person.displayName,
    ...person.aliases,
    person.dm.matchedThreadTitle,
    person.username.replace(/^dm:/, ""),
  ]);
  if (best) {
    person.displayName = formatAccountDisplayName(best);
  } else if (
    person.displayName === UNKNOWN_ACCOUNT_LABEL &&
    person.username &&
    !person.username.startsWith("dm:") &&
    !/^\d{8,}$/.test(person.username)
  ) {
    person.displayName = formatAccountDisplayName(person.username);
  }
}

function applyInteractionsToPerson(
  person: CanonicalPerson,
  interactionCounts: Map<
    string,
    { likes: number; comments: number; stories: number; saves: number }
  > | undefined,
  interactionMeta: InteractionExportMeta | undefined,
  searchByUsername?: Map<string, number>,
  hasSearchExport?: boolean
): void {
  const aliasList = [
    person.username,
    person.displayName,
    ...person.aliases,
    person.dm.matchedThreadTitle ?? "",
  ].filter(Boolean);

  const stats = resolveInteractionsForAliases(
    aliasList,
    interactionCounts,
    interactionMeta
  );

  person.likedCount = stats.likes;
  person.likesAttribution = stats.likesStatus;
  person.commentedCount = stats.comments;
  person.commentsAttribution = stats.commentsStatus;
  person.storyInteractionCount = stats.stories;
  person.storiesAttribution = stats.storiesStatus;

  person.searchCount = resolveSearchForPerson(
    person.username,
    person.displayName,
    searchByUsername,
    person.aliases
  );
  person.searchAttribution = hasSearchExport
    ? person.searchCount > 0
      ? "attributed"
      : "not_matched"
    : "not_in_export";
}

function createPersonFromDmRecord(
  record: DmPersonRecord,
  network: NetworkStats
): CanonicalPerson {
  const username = record.username;
  const canonicalId = isLikelyInstagramUsername(username)
    ? identityNormalizeUsername(username)
    : record.stableKey;
  const displayName = formatAccountDisplayName(record.displayName);
  const aliases = new Set<string>();
  aliases.add(username);
  if (isLikelyInstagramUsername(username)) {
    aliases.add(identityNormalizeUsername(username));
  }
  if (
    displayName &&
    displayName !== UNKNOWN_ACCOUNT_LABEL &&
    identityNormalizeUsername(displayName) !== identityNormalizeUsername(username)
  ) {
    aliases.add(normalizeIdentityKey(displayName));
  }

  const follower = network.followers.find((a) =>
    usernamesMatch(a.username, username)
  );
  const following = network.following.find((a) =>
    usernamesMatch(a.username, username)
  );

  return {
    canonicalId,
    username,
    displayName,
    normalizedUsername: normalizeUsername(username.replace(/^dm:/, "")),
    aliases: [...aliases],
    sourceRefs: ["Direct DM threads (normalized)"],
    confidence: record.matchConfidence,
    isUnknownOrDeleted: record.isUnknownOrDeleted,
    followsMe: Boolean(follower),
    iFollowThem: Boolean(following),
    isMutual: Boolean(follower && following),
    followedMeAt: follower?.timestamp,
    iFollowedAt: following?.timestamp,
    dm: {
      status: record.dmMatchStatus === "possible" ? "possible" : "matched",
      directDmCount: record.directDmCount,
      directDmSentByMe: record.directDmSentByMe,
      directDmSentByThem: record.directDmSentByThem,
      firstDmAt: record.firstDmAt,
      lastDmAt: record.lastDmAt,
      threadIds: [...record.threadIds],
      matchMethod: record.matchMethod,
      matchConfidence: record.matchConfidence,
      matchedThreadTitle: record.threadTitles[0],
      sources: record.threadTitles.map(
        (t) => `DM thread "${t}" via ${record.matchMethod.replace(/-/g, " ")}`
      ),
      senderSplitAvailable: record.senderSplitAvailable,
      senderSplitConfidence: record.senderSplitConfidence,
    },
    groupMessagesSent: 0,
    groupChatsShared: 0,
    likedCount: 0,
    likesAttribution: "not_matched",
    commentedCount: 0,
    commentsAttribution: "not_matched",
    storyInteractionCount: 0,
    storiesAttribution: "not_matched",
    searchCount: 0,
    searchAttribution: "not_matched",
  };
}

function resolveDmRecordToCanonicalId(
  record: DmPersonRecord,
  persons: Map<string, CanonicalPerson>
): string | null {
  if (isLikelyInstagramUsername(record.username)) {
    const user = identityNormalizeUsername(record.username);
    if (persons.has(user)) return user;
    for (const person of persons.values()) {
      if (usernamesMatch(person.username, user)) return person.canonicalId;
    }
  }
  if (persons.has(record.stableKey)) return record.stableKey;
  return null;
}

function applyGroupSender(
  person: CanonicalPerson,
  sender: GroupSenderRecord
): void {
  person.groupMessagesSent += sender.messagesSent;
  if (!person.sourceRefs.includes("Group chat sender messages")) {
    person.sourceRefs.push("Group chat sender messages");
  }
}

function createPersonFromGroupSender(
  sender: GroupSenderRecord,
  network: NetworkStats
): CanonicalPerson {
  const base = createPersonFromDmRecord(
    {
      ...sender,
      key: sender.key,
      stableKey: sender.stableKey,
      directDmCount: 0,
      directDmSentByMe: 0,
      directDmSentByThem: 0,
      threadIds: [],
      threadTitles: [],
      matchMethod: "sender-name",
      matchConfidence: "medium",
      dmMatchStatus: "none",
      senderSplitAvailable: false,
      senderSplitConfidence: "low",
    },
    network
  );
  base.groupMessagesSent = sender.messagesSent;
  base.dm = emptyDmMatch();
  base.dm.status = "none";
  return base;
}

function createPersonFromNetwork(
  acc: {
    username: string;
    displayUsername: string;
    href?: string;
    timestamp?: number;
  },
  network: NetworkStats
): CanonicalPerson {
  const username = normalizeUsername(acc.username);
  const displayName = acc.displayUsername || username;
  const cleanedDisplay = formatAccountDisplayName(displayName);
  const aliases = new Set<string>();
  aliases.add(username);
  aliases.add(identityNormalizeUsername(username));
  if (displayName) {
    aliases.add(normalizeIdentityKey(displayName));
  }

  const follower = network.followers.find((a) => a.username === username);
  const following = network.following.find((a) => a.username === username);

  return {
    canonicalId: username,
    username,
    displayName: cleanedDisplay,
    normalizedUsername: username,
    aliases: [...aliases],
    sourceRefs: ["followers/following export"],
    confidence: "high",
    isUnknownOrDeleted: false,
    followsMe: Boolean(follower),
    iFollowThem: Boolean(following),
    isMutual: Boolean(follower && following),
    followedMeAt: follower?.timestamp,
    iFollowedAt: following?.timestamp,
    dm: emptyDmMatch(),
    groupMessagesSent: 0,
    groupChatsShared: 0,
    likedCount: 0,
    likesAttribution: "not_matched",
    commentedCount: 0,
    commentsAttribution: "not_matched",
    storyInteractionCount: 0,
    storiesAttribution: "not_matched",
    searchCount: 0,
    searchAttribution: "not_matched",
  };
}

function registerAlias(
  aliasToCanonical: Map<string, string>,
  alias: string,
  canonicalId: string
): void {
  const user = identityNormalizeUsername(alias);
  if (isLikelyInstagramUsername(user) && !aliasToCanonical.has(user)) {
    aliasToCanonical.set(user, canonicalId);
  }
}

function resolveCanonicalId(
  candidate: string,
  aliasToCanonical: Map<string, string>,
  persons: Map<string, CanonicalPerson>
): { id: string; method: MatchMethod; confidence: NameConfidence } | null {
  if (!candidate?.trim()) return null;

  const user = identityNormalizeUsername(candidate);
  if (isLikelyInstagramUsername(user)) {
    if (persons.has(user)) {
      return { id: user, method: "exact-username", confidence: "high" };
    }
    if (aliasToCanonical.has(user)) {
      return {
        id: aliasToCanonical.get(user)!,
        method: "exact-username",
        confidence: "high",
      };
    }
  }

  return null;
}

function isDirectThread(thread: DmThreadAnalytics): boolean {
  if (thread.isGroupChat) return false;
  const senderCount = Object.keys(thread.messagesBySender ?? {}).length;
  if (thread.participantCount > 2) return false;
  if (senderCount > 2) return false;
  return true;
}

function isGroupThread(thread: DmThreadAnalytics): boolean {
  if (thread.isGroupChat) return true;
  const senderCount = Object.keys(thread.messagesBySender ?? {}).length;
  return thread.participantCount > 2 || senderCount > 2;
}

interface CandidateMatch {
  candidate: string;
  method: MatchMethod;
}

function collectDirectThreadCandidates(
  thread: DmThreadAnalytics,
  owner: ExportOwnerIdentity
): CandidateMatch[] {
  const out: CandidateMatch[] = [];
  const seen = new Set<string>();

  const add = (raw: string | null | undefined, method: MatchMethod) => {
    if (!raw?.trim() || isOwnerName(raw, owner)) return;
    const key = normalizeIdentityKey(raw);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ candidate: raw.trim(), method });
  };

  const folderSlug = slugFromPath(thread.sourcePath ?? thread.threadPath);
  if (folderSlug) add(folderSlug, "folder-path");

  for (const p of thread.participants ?? []) add(p, "participant-name");
  for (const sender of Object.keys(thread.messagesBySender ?? {})) {
    add(sender, "sender-name");
  }
  if (thread.threadName) add(thread.threadName, "thread-title");
  if (thread.title) add(thread.title, "thread-title");

  return out;
}

export interface BuildIdentityGraphParams {
  network: NetworkStats | null;
  messages: DmAnalytics | null;
  interactionCounts?: Map<
    string,
    { likes: number; comments: number; stories: number; saves: number }
  >;
  interactionMeta?: InteractionExportMeta;
  searchByUsername?: Map<string, number>;
  hasSearchExport?: boolean;
  coreAnalytics?: import("@/lib/insights/coreAnalytics").CoreAnalytics;
  files?: Map<string, string>;
}

export function buildIdentityGraph(
  params: BuildIdentityGraphParams
): IdentityGraph {
  const {
    network,
    messages,
    interactionCounts,
    interactionMeta,
    searchByUsername,
    hasSearchExport = Boolean(searchByUsername && searchByUsername.size > 0),
    coreAnalytics: coreAnalyticsInput,
    files,
  } = params;

  const persons = new Map<string, CanonicalPerson>();
  const aliasToCanonical = new Map<string, string>();
  const matchRows: IdentityMatchDebugRow[] = [];
  const unmatchedRows: UnmatchedDmThreadRow[] = [];

  if (!network) {
    return {
      persons,
      aliasToCanonical,
      debug: {
        totalCanonicalPeople: 0,
        networkOnlyPeople: 0,
        directDmMatchedPeople: 0,
        possibleDmMatches: 0,
        unmatchedDmThreads: 0,
        topMatches: [],
        topUnmatched: [],
      },
    };
  }

  const allNetwork = [
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

  for (const acc of allNetwork) {
    const username = normalizeUsername(acc.username);
    if (persons.has(username)) continue;
    const person = createPersonFromNetwork(acc, network);
    persons.set(username, person);
    for (const alias of person.aliases) {
      registerAlias(aliasToCanonical, alias, username);
    }
  }

  const core =
    coreAnalyticsInput ??
    buildCoreAnalytics({ messages, network, files });

  const dmByCanonical = new Map<string, DmPersonRecord>();
  for (const record of core.dmPeople) {
    const existing = dmByCanonical.get(record.stableKey);
    if (existing) {
      const merged: DmPersonRecord = {
        ...existing,
        directDmCount: existing.directDmCount + record.directDmCount,
        directDmSentByMe: existing.directDmSentByMe + record.directDmSentByMe,
        directDmSentByThem:
          existing.directDmSentByThem + record.directDmSentByThem,
        firstDmAt:
          existing.firstDmAt !== undefined && record.firstDmAt !== undefined
            ? Math.min(existing.firstDmAt, record.firstDmAt)
            : existing.firstDmAt ?? record.firstDmAt,
        lastDmAt:
          record.lastDmAt !== undefined
            ? Math.max(existing.lastDmAt ?? 0, record.lastDmAt)
            : existing.lastDmAt,
        threadIds: [...new Set([...existing.threadIds, ...record.threadIds])],
        threadTitles: [
          ...new Set([...existing.threadTitles, ...record.threadTitles]),
        ],
      };
      dmByCanonical.set(record.stableKey, merged);
    } else {
      dmByCanonical.set(record.stableKey, { ...record });
    }
  }

  for (const record of dmByCanonical.values()) {
    const networkId = resolveDmRecordToCanonicalId(record, persons);
    const personId =
      networkId ??
      (isLikelyInstagramUsername(record.username)
        ? identityNormalizeUsername(record.username)
        : record.stableKey);

    if (persons.has(personId)) {
      applyDmRecordToPerson(persons.get(personId)!, record);
      const person = persons.get(personId)!;
      matchRows.push({
        resolvedName: person.displayName,
        username: person.username.startsWith("dm:") ||
          person.username.startsWith("thread:") ||
          person.username.startsWith("unknown:")
          ? undefined
          : person.username,
        messageCount: record.directDmCount,
        matchMethod: record.matchMethod,
        confidence: record.matchConfidence,
        threadTitle: record.threadTitles[0],
      });
    } else if (network) {
      const person = createPersonFromDmRecord(record, network);
      persons.set(person.canonicalId, person);
      for (const alias of person.aliases) {
        registerAlias(aliasToCanonical, alias, person.canonicalId);
      }
      matchRows.push({
        resolvedName: person.displayName,
        username: person.username.startsWith("dm:") ||
          person.username.startsWith("thread:") ||
          person.username.startsWith("unknown:")
          ? undefined
          : person.username,
        messageCount: record.directDmCount,
        matchMethod: record.matchMethod,
        confidence: record.matchConfidence,
        threadTitle: record.threadTitles[0],
      });
    } else if (!networkId) {
      unmatchedRows.push({
        threadId: record.threadIds[0] ?? record.key,
        title: record.threadTitles[0] ?? record.displayName,
        messageCount: record.directDmCount,
        participants: record.threadTitles,
        folderSlug: undefined,
      });
    }
  }

  for (const sender of core.groupSenders) {
    let personId: string | null = null;
    if (isLikelyInstagramUsername(sender.username)) {
      const user = identityNormalizeUsername(sender.username);
      if (persons.has(user)) personId = user;
    }
    if (!personId) {
      const hit = resolveCanonicalId(
        sender.username,
        aliasToCanonical,
        persons
      );
      personId = hit?.id ?? null;
    }

    if (personId && persons.has(personId)) {
      applyGroupSender(persons.get(personId)!, sender);
      continue;
    }

    if (!network) continue;

    const syntheticId = sender.stableKey;
    if (persons.has(syntheticId)) {
      applyGroupSender(persons.get(syntheticId)!, sender);
      continue;
    }

    const person = createPersonFromGroupSender(sender, network);
    persons.set(person.canonicalId, person);
    for (const alias of person.aliases) {
      registerAlias(aliasToCanonical, alias, person.canonicalId);
    }
  }

  for (const person of persons.values()) {
    applyInteractionsToPerson(
      person,
      interactionCounts,
      interactionMeta,
      searchByUsername,
      hasSearchExport
    );
    finalizePersonDisplayName(person);
  }

  const networkOnly = [...persons.values()].filter(
    (p) =>
      !p.canonicalId.startsWith("unknown:") &&
      p.dm.status === "none" &&
      p.groupMessagesSent === 0 &&
      p.likesAttribution !== "attributed"
  ).length;

  const directMatched = [...persons.values()].filter(
    (p) => p.dm.status === "matched" && !p.isUnknownOrDeleted
  ).length;
  const possibleMatches = [...persons.values()].filter(
    (p) => p.dm.status === "possible"
  ).length;

  matchRows.sort((a, b) => b.messageCount - a.messageCount);
  unmatchedRows.sort((a, b) => b.messageCount - a.messageCount);

  return {
    persons,
    aliasToCanonical,
    coreAnalytics: core,
    debug: {
      totalCanonicalPeople: persons.size,
      networkOnlyPeople: networkOnly,
      directDmMatchedPeople: directMatched,
      possibleDmMatches: possibleMatches,
      unmatchedDmThreads: unmatchedRows.length,
      topMatches: matchRows.slice(0, 20),
      topUnmatched: unmatchedRows.slice(0, 20),
    },
  };
}

function resolveSearchForPerson(
  username: string,
  displayName: string,
  searchByUsername?: Map<string, number>,
  aliases: string[] = []
): number {
  if (!searchByUsername?.size) return 0;
  const keys = new Set<string>();
  const user = identityNormalizeUsername(username);
  if (isLikelyInstagramUsername(user)) keys.add(user);
  for (const alias of aliases) {
    const a = identityNormalizeUsername(alias);
    if (isLikelyInstagramUsername(a)) keys.add(a);
  }
  for (const key of keys) {
    const hit = searchByUsername.get(key);
    if (hit) return hit;
  }
  return 0;
}

export function findPersonByQuery(
  graph: IdentityGraph,
  query: string
): CanonicalPerson | undefined {
  const user = identityNormalizeUsername(query);
  if (isLikelyInstagramUsername(user)) {
    if (graph.persons.has(user)) return graph.persons.get(user);
    const id = graph.aliasToCanonical.get(user);
    if (id) return graph.persons.get(id);
  }
  return undefined;
}

export interface DmAccountStats {
  directDmCount: number;
  groupMessagesSent: number;
  groupChatsShared: number;
  hasDirectThread: boolean;
  lastDirectDmAt?: number;
  firstDirectDmAt?: number;
  directDmSentByMe: number;
  directDmSentByThem: number;
  directThreadIds: string[];
  displayName: string;
  confidence: NameConfidence;
  isUnknown: boolean;
  dmMatchStatus: DmMatchStatus;
  matchMethod?: MatchMethod;
  sources: string[];
}

export function personToDmStats(person: CanonicalPerson): DmAccountStats {
  return {
    directDmCount: person.dm.directDmCount,
    groupMessagesSent: person.groupMessagesSent,
    groupChatsShared: person.groupChatsShared,
    hasDirectThread:
      person.dm.status === "matched" || person.dm.status === "possible",
    lastDirectDmAt: person.dm.lastDmAt,
    firstDirectDmAt: person.dm.firstDmAt,
    directDmSentByMe: person.dm.directDmSentByMe,
    directDmSentByThem: person.dm.directDmSentByThem,
    directThreadIds: person.dm.threadIds,
    displayName: person.displayName,
    confidence: person.dm.matchConfidence || person.confidence,
    isUnknown: person.isUnknownOrDeleted,
    dmMatchStatus: person.dm.status,
    matchMethod: person.dm.matchMethod,
    sources: [...person.sourceRefs, ...person.dm.sources],
  };
}

export function buildDmStatsFromGraph(
  graph: IdentityGraph
): Map<string, DmAccountStats> {
  const map = new Map<string, DmAccountStats>();
  for (const person of graph.persons.values()) {
    map.set(person.canonicalId, personToDmStats(person));
  }
  return map;
}

export function toSourceBreakdownFromPerson(
  person: CanonicalPerson
): AccountSourceBreakdown {
  const explanations: string[] = [...person.sourceRefs, ...person.dm.sources];
  if (
    person.isMutual &&
    person.dm.status === "none" &&
    person.groupMessagesSent === 0
  ) {
    explanations.push("Mutual follow only");
  }
  if (person.likesAttribution === "attributed" && person.likedCount > 0) {
    explanations.push("Likes attributed from activity export");
  } else if (person.likesAttribution === "not_in_export") {
    explanations.push("Likes not attributable in this export");
  } else if (person.likesAttribution === "not_matched") {
    explanations.push("Likes export present but not matched to this account");
  }

  return {
    directDmMessages: person.dm.directDmCount,
    groupMessagesSent: person.groupMessagesSent,
    groupChatsShared: person.groupChatsShared,
    isMutual: person.isMutual,
    followsMe: person.followsMe,
    iFollowThem: person.iFollowThem,
    likedCount: person.likedCount,
    commentedCount: person.commentedCount,
    storyInteractionCount: person.storyInteractionCount,
    lastDirectDmAt: person.dm.lastDmAt,
    confidence: person.dm.matchConfidence || person.confidence,
    explanations,
    isUnknownAccount: person.isUnknownOrDeleted,
  };
}

export function buildThreadDebugFromGraph(
  graph: IdentityGraph,
  params: {
    messages: DmAnalytics | null;
    network: NetworkStats | null;
  }
): DmThreadDebugEntry[] {
  const { messages, network } = params;
  if (!messages) return [];

  const owner = inferAccountOwnerKeys(network, messages);
  const debug: DmThreadDebugEntry[] = [];

  for (const thread of messages.threads ?? []) {
    const senders = thread.messagesBySender ?? {};
    const direct = isDirectThread(thread);

    if (direct) {
      const candidates = collectDirectThreadCandidates(thread, owner);
      let matchedPerson: CanonicalPerson | undefined;
      for (const { candidate } of candidates) {
        const hit = resolveCanonicalId(
          candidate,
          graph.aliasToCanonical,
          graph.persons
        );
        if (hit) {
          matchedPerson = graph.persons.get(hit.id);
          break;
        }
      }

      debug.push({
        threadId: thread.id,
        title: thread.threadName,
        sourcePath: thread.sourcePath,
        participantCount: thread.participantCount,
        isGroup: false,
        totalMessages: thread.messageCount,
        senderCounts: { ...senders },
        inferredOtherParticipant:
          matchedPerson?.displayName ??
          pickBestDisplayName(candidates.map((c) => c.candidate)) ??
          UNKNOWN_ACCOUNT_LABEL,
        contributesToDirectLeaderboard: Boolean(
          matchedPerson && !matchedPerson.isUnknownOrDeleted
        ),
        contributesToGroupLeaderboard: false,
        nameConfidence: matchedPerson?.dm.matchConfidence ?? "low",
        isUnknownAccount: !matchedPerson,
      });
      continue;
    }

    if (isGroupThread(thread)) {
      debug.push({
        threadId: thread.id,
        title: thread.threadName,
        sourcePath: thread.sourcePath,
        participantCount: thread.participantCount,
        isGroup: true,
        totalMessages: thread.messageCount,
        senderCounts: { ...senders },
        contributesToDirectLeaderboard: false,
        contributesToGroupLeaderboard: true,
        nameConfidence: "medium",
        isUnknownAccount: false,
      });
    }
  }

  return debug;
}

export function buildDmStatsAndDebug(params: {
  messages: DmAnalytics | null;
  network: NetworkStats | null;
  interactionCounts?: Map<
    string,
    { likes: number; comments: number; stories: number; saves: number }
  >;
  interactionMeta?: InteractionExportMeta;
  searchByUsername?: Map<string, number>;
  hasSearchExport?: boolean;
  coreAnalytics?: import("@/lib/insights/coreAnalytics").CoreAnalytics;
  files?: Map<string, string>;
}): {
  statsByKey: Map<string, DmAccountStats>;
  threadDebug: DmThreadDebugEntry[];
  graph: IdentityGraph;
} {
  const graph = buildIdentityGraph({ ...params, files: params.files });
  const statsByKey = buildDmStatsFromGraph(graph);
  const threadDebug = buildThreadDebugFromGraph(graph, params);
  return { statsByKey, threadDebug, graph };
}
