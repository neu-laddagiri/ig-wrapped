import {
  formatAccountDisplayName,
  isInstagramPlaceholderName,
  pickBestDisplayName,
  UNKNOWN_ACCOUNT_LABEL,
} from "@/lib/accountNameFilter";
import {
  getCanonicalAccountKey,
  isLikelyInstagramUsername,
  normalizeUsername as identityNormalizeUsername,
  rawFolderSegment,
  usernameFromFolderPath,
} from "@/lib/accountIdentity";
import { normalizeIdentityKey } from "@/lib/identityResolver";
import {
  resolveExportOwnerIdentity,
  isExportOwnerName,
  type ExportOwnerIdentity,
} from "@/lib/exportOwnerIdentity";
import {
  isDirectDmThread,
  normalizeDmThreadList,
  type NormalizedDmThread,
} from "@/lib/dmThreads";
import { formatTimestamp } from "@/lib/formatters";
import type { DmAnalytics, NetworkStats } from "@/types/instagram";

/** One direct 1-on-1 DM thread — same shape the DMs tab lists. */
export interface DirectDmRecord {
  threadId: string;
  accountKey: string;
  displayName: string;
  username?: string;
  aliases: string[];
  totalMessages: number;
  firstDmAt?: number;
  lastDmAt?: number;
  mostActiveMonth?: string;
  messagesBySender?: Record<string, number>;
  source: "dm-thread";
  confidence: "high";
}

export interface DirectDmIndex {
  byThreadId: Map<string, DirectDmRecord>;
  byAccountKey: Map<string, DirectDmRecord>;
  byCanonicalName: Map<string, DirectDmRecord>;
  byDisplayName: Map<string, DirectDmRecord>;
  records: DirectDmRecord[];
}

function inferOtherName(
  thread: NormalizedDmThread,
  owner?: ExportOwnerIdentity
): string | null {
  const candidates: string[] = [];
  const folderRaw = rawFolderSegment(thread.sourcePath);
  if (folderRaw) candidates.push(folderRaw);

  for (const p of thread.participants ?? []) {
    if (!owner || !isExportOwnerName(p, owner)) candidates.push(p);
  }
  for (const sender of Object.keys(thread.messagesBySender ?? {})) {
    if (!owner || !isExportOwnerName(sender, owner)) candidates.push(sender);
  }
  if (
    thread.title &&
    !thread.isGroup &&
    !thread.title.startsWith("Group chat")
  ) {
    if (!owner || !isExportOwnerName(thread.title, owner)) {
      candidates.push(thread.title);
    }
  }

  const best = pickBestDisplayName(candidates) ?? candidates[0];
  return best?.trim() || null;
}

function threadToRecord(
  thread: NormalizedDmThread,
  network?: NetworkStats | null,
  owner?: ExportOwnerIdentity
): DirectDmRecord | null {
  const folderUser = usernameFromFolderPath(thread.sourcePath);
  const otherName = inferOtherName(thread, owner);

  let accountKey = getCanonicalAccountKey({
    folderPath: thread.sourcePath,
    threadId: thread.id,
  });
  let displayName = formatAccountDisplayName(
    thread.displayTitle || thread.title || UNKNOWN_ACCOUNT_LABEL
  );
  let username: string | undefined;
  const aliases = new Set<string>();

  if (folderUser) {
    accountKey = folderUser;
    username = folderUser;
    aliases.add(folderUser);
    displayName =
      otherName && !isInstagramPlaceholderName(otherName)
        ? formatAccountDisplayName(otherName)
        : folderUser;
  } else if (otherName && isLikelyInstagramUsername(otherName)) {
    accountKey = identityNormalizeUsername(otherName);
    username = accountKey;
    aliases.add(accountKey);
    displayName = isInstagramPlaceholderName(otherName)
      ? UNKNOWN_ACCOUNT_LABEL
      : formatAccountDisplayName(otherName);
  } else if (otherName && network) {
    const norm = identityNormalizeUsername(otherName);
    let matched = false;
    for (const acc of [
      ...network.followers,
      ...network.following,
      ...network.mutuals,
    ]) {
      if (identityNormalizeUsername(acc.username) === norm) {
        accountKey = norm;
        username = norm;
        aliases.add(norm);
        displayName = formatAccountDisplayName(
          acc.displayUsername || otherName
        );
        matched = true;
        break;
      }
    }
    if (!matched) {
      username = undefined;
      displayName = isInstagramPlaceholderName(otherName)
        ? UNKNOWN_ACCOUNT_LABEL
        : formatAccountDisplayName(otherName);
    }
  } else if (otherName) {
    displayName = isInstagramPlaceholderName(otherName)
      ? UNKNOWN_ACCOUNT_LABEL
      : formatAccountDisplayName(otherName);
  } else {
    displayName = formatAccountDisplayName(thread.displayTitle || thread.title);
  }

  if (otherName) {
    aliases.add(otherName);
    aliases.add(normalizeIdentityKey(otherName));
  }
  if (username) aliases.add(username);
  aliases.add(accountKey);
  aliases.add(thread.id);
  aliases.add(`thread:${thread.id}`);

  return {
    threadId: thread.id,
    accountKey,
    displayName,
    username,
    aliases: [...aliases],
    totalMessages: thread.totalMessages,
    firstDmAt: thread.firstMessageAt,
    lastDmAt: thread.lastMessageAt,
    mostActiveMonth: thread.mostActiveMonth,
    messagesBySender: { ...thread.messagesBySender },
    source: "dm-thread",
    confidence: "high",
  };
}

function mergeAggregated(
  existing: DirectDmRecord,
  incoming: DirectDmRecord
): DirectDmRecord {
  return {
    ...existing,
    totalMessages: existing.totalMessages + incoming.totalMessages,
    firstDmAt:
      existing.firstDmAt !== undefined && incoming.firstDmAt !== undefined
        ? Math.min(existing.firstDmAt, incoming.firstDmAt)
        : existing.firstDmAt ?? incoming.firstDmAt,
    lastDmAt:
      incoming.lastDmAt !== undefined
        ? Math.max(existing.lastDmAt ?? 0, incoming.lastDmAt)
        : existing.lastDmAt,
    aliases: [...new Set([...existing.aliases, ...incoming.aliases])],
    threadId: existing.threadId,
  };
}

/** Build index from normalized direct threads — same filter as DMs tab. */
export function buildDirectDmIndex(
  threads: NormalizedDmThread[],
  options?: {
    network?: NetworkStats | null;
    owner?: ExportOwnerIdentity;
    messages?: DmAnalytics | null;
    files?: Map<string, string>;
  }
): DirectDmIndex {
  const owner =
    options?.owner ??
    (options?.network || options?.messages || options?.files
      ? resolveExportOwnerIdentity({
          files: options?.files,
          messages: options?.messages ?? null,
        })
      : undefined);

  const directThreads = threads.filter((t) => isDirectDmThread(t));
  const records: DirectDmRecord[] = [];

  for (const thread of directThreads) {
    const record = threadToRecord(thread, options?.network, owner);
    if (record) records.push(record);
  }

  return indexFromDirectDmRecords(records);
}

export function buildDirectDmIndexFromMessages(
  messages: DmAnalytics | null | undefined,
  options?: {
    network?: NetworkStats | null;
    files?: Map<string, string>;
  }
): DirectDmIndex {
  const threads = normalizeDmThreadList(messages);
  return buildDirectDmIndex(threads, {
    network: options?.network,
    messages: messages ?? null,
    files: options?.files,
  });
}

export function indexFromDirectDmRecords(
  records: DirectDmRecord[]
): DirectDmIndex {
  const byThreadId = new Map<string, DirectDmRecord>();
  const byAccountKey = new Map<string, DirectDmRecord>();
  const byCanonicalName = new Map<string, DirectDmRecord>();
  const byDisplayName = new Map<string, DirectDmRecord>();

  for (const record of records) {
    byThreadId.set(record.threadId, record);

    const existingKey = byAccountKey.get(record.accountKey);
    if (existingKey) {
      byAccountKey.set(record.accountKey, mergeAggregated(existingKey, record));
    } else {
      byAccountKey.set(record.accountKey, { ...record });
    }

    const canon = normalizeIdentityKey(record.accountKey);
    if (canon && !byCanonicalName.has(canon)) {
      byCanonicalName.set(canon, record);
    }

    const displayKey = normalizeIdentityKey(record.displayName);
    if (displayKey && !byDisplayName.has(displayKey)) {
      byDisplayName.set(displayKey, record);
    }
  }

  const aggregated = [...byAccountKey.values()].sort(
    (a, b) => b.totalMessages - a.totalMessages
  );

  return {
    byThreadId,
    byAccountKey,
    byCanonicalName,
    byDisplayName,
    records: aggregated,
  };
}

export function resolveDirectDmRecord(
  index: DirectDmIndex,
  params: { threadId?: string; accountKey?: string }
): DirectDmRecord | undefined {
  if (params.threadId) {
    const exact = index.byThreadId.get(params.threadId);
    if (exact) return exact;
  }
  if (params.accountKey) {
    const key = params.accountKey.trim();
    return (
      index.byAccountKey.get(key) ??
      index.byAccountKey.get(identityNormalizeUsername(key)) ??
      index.byCanonicalName.get(normalizeIdentityKey(key))
    );
  }
  return undefined;
}

export function directDmRankReason(
  record: DirectDmRecord | undefined,
  isMutual?: boolean
): string {
  if (!record || record.totalMessages <= 0) {
    return isMutual
      ? "Network only · mutual · no direct DMs"
      : "Network only · no direct DMs";
  }
  const parts = [`${record.totalMessages.toLocaleString()} direct DMs`];
  if (record.lastDmAt) {
    const label = formatTimestamp(record.lastDmAt);
    if (label !== "—") parts.push(`active ${label}`);
  }
  if (isMutual) parts.push("mutual");
  return parts.join(" · ");
}

export function compareDirectDmForLinkedIn(
  a: DirectDmRecord | undefined,
  b: DirectDmRecord | undefined,
  aMutual: boolean,
  bMutual: boolean,
  aLabel: string,
  bLabel: string
): number {
  const aCount = a?.totalMessages ?? 0;
  const bCount = b?.totalMessages ?? 0;
  if (bCount !== aCount) return bCount - aCount;

  const aTs = a?.lastDmAt ?? 0;
  const bTs = b?.lastDmAt ?? 0;
  if (bTs !== aTs) return bTs - aTs;

  const aM = aMutual ? 1 : 0;
  const bM = bMutual ? 1 : 0;
  if (bM !== aM) return bM - aM;

  return aLabel.localeCompare(bLabel);
}

export interface DirectDmParityRow {
  name: string;
  username?: string;
  count: number;
}

/** Dev-only parity check across tabs. */
export function validateDirectDmParity(params: {
  dmTabTop: DirectDmParityRow[];
  linkedInTop: DirectDmParityRow[];
  leaderboardTop: DirectDmParityRow[];
}): { ok: boolean; notes: string[] } {
  const notes: string[] = [];
  const { dmTabTop, linkedInTop, leaderboardTop } = params;

  for (let i = 0; i < Math.min(10, dmTabTop.length); i++) {
    const dm = dmTabTop[i];
    const li = linkedInTop[i];
    const lb = leaderboardTop[i];
    if (li && li.count !== dm.count) {
      notes.push(
        `LinkedIn #${i + 1}: DMs tab ${dm.name} (${dm.count}) vs LinkedIn ${li.name} (${li.count})`
      );
    }
    if (lb && lb.count !== dm.count) {
      notes.push(
        `Leaderboard #${i + 1}: DMs tab ${dm.name} (${dm.count}) vs board ${lb.name} (${lb.count})`
      );
    }
  }

  if (process.env.NODE_ENV === "development" && notes.length > 0) {
    console.warn("[IG Wrapped DM parity]", notes.slice(0, 10));
  } else if (process.env.NODE_ENV === "development") {
    console.info("[IG Wrapped DM parity] top-10 aligned across DMs / LinkedIn / leaderboards");
  }

  return { ok: notes.length === 0, notes };
}

/** Top direct threads as shown on DMs tab (per-thread, not aggregated). */
export function topDirectDmThreadsFromIndex(
  index: DirectDmIndex,
  limit = 50
): DirectDmRecord[] {
  return [...index.byThreadId.values()]
    .sort((a, b) => b.totalMessages - a.totalMessages)
    .slice(0, limit);
}
