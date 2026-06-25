import { formatAccountDisplayName } from "@/lib/accountNameFilter";
import type { CoreAnalytics, DmPersonRecord } from "@/lib/insights/coreAnalytics";
import type { MatchMethod } from "@/lib/identityResolver";
import type { UnifiedAccount, NameConfidence, DmMatchStatus } from "@/types/insights";
import {
  normalizeUsername,
  usernamesMatch,
} from "@/lib/accountIdentity";

export interface DmAccountIndexEntry {
  canonicalKey: string;
  displayName: string;
  username: string;
  directDmCount: number;
  directDmSentByMe: number;
  directDmSentByThem: number;
  firstDmAt?: number;
  lastDmAt?: number;
  mostActiveMonth?: string;
  threadIds: string[];
  folderSlugs: string[];
  threadType: "direct";
  matchMethod: MatchMethod;
  matchConfidence: NameConfidence;
  senderSplitAvailable: boolean;
  senderSplitConfidence: NameConfidence;
  dmMatchStatus: DmMatchStatus;
}

export interface DmLookupResult {
  entry: DmAccountIndexEntry;
  matchMethod: MatchMethod;
  matchConfidence: NameConfidence;
}

export interface DmAccountIndex {
  entries: DmAccountIndexEntry[];
  byCanonicalKey: Map<string, DmAccountIndexEntry>;
  /** Exact normalized username lookup only. */
  lookupByUsername(username: string): DmLookupResult | null;
}

function recordToEntry(record: DmPersonRecord): DmAccountIndexEntry {
  return {
    canonicalKey: record.stableKey,
    displayName: formatAccountDisplayName(record.displayName),
    username: record.username,
    directDmCount: record.directDmCount,
    directDmSentByMe: record.directDmSentByMe,
    directDmSentByThem: record.directDmSentByThem,
    firstDmAt: record.firstDmAt,
    lastDmAt: record.lastDmAt,
    mostActiveMonth: record.mostActiveMonth,
    threadIds: [...record.threadIds],
    folderSlugs: [...(record.folderSlugs ?? [])],
    threadType: "direct",
    matchMethod: record.matchMethod,
    matchConfidence: record.matchConfidence,
    senderSplitAvailable: record.senderSplitAvailable,
    senderSplitConfidence: record.senderSplitConfidence,
    dmMatchStatus:
      record.dmMatchStatus === "possible" ? "possible" : "matched",
  };
}

export function buildDmAccountIndex(
  coreAnalytics: CoreAnalytics
): DmAccountIndex {
  const entries: DmAccountIndexEntry[] = coreAnalytics.dmPeople.map(recordToEntry);
  const byCanonicalKey = new Map<string, DmAccountIndexEntry>();

  for (const entry of entries) {
    byCanonicalKey.set(entry.canonicalKey, entry);
    const normUser = normalizeUsername(entry.username);
    if (normUser && !byCanonicalKey.has(normUser)) {
      byCanonicalKey.set(normUser, entry);
    }
  }

  function lookupByUsername(username: string): DmLookupResult | null {
    const key = normalizeUsername(username);
    if (!key) return null;
    const entry = byCanonicalKey.get(key);
    if (!entry) return null;
    if (!usernamesMatch(entry.username, key) && entry.canonicalKey !== key) {
      return null;
    }
    return {
      entry,
      matchMethod: entry.matchMethod,
      matchConfidence: entry.matchConfidence,
    };
  }

  return { entries, byCanonicalKey, lookupByUsername };
}

function applyDmLookupToAccount(
  account: UnifiedAccount,
  hit: DmLookupResult
): UnifiedAccount {
  const { entry } = hit;
  if (!usernamesMatch(account.username, entry.username)) {
    return account;
  }
  if (
    entry.directDmCount <= (account.dmMessageCount ?? 0) &&
    account.hasDmThread &&
    account.dmMatchStatus === "matched"
  ) {
    return account;
  }

  const note = `DM source of truth: ${entry.directDmCount.toLocaleString()} direct messages (${entry.matchMethod.replace(/-/g, " ")})`;

  return {
    ...account,
    hasDmThread: true,
    dmMatchStatus:
      entry.matchConfidence === "medium" && account.dmMatchStatus !== "matched"
        ? "possible"
        : "matched",
    dmMessageCount: entry.directDmCount,
    dmThreadId: entry.threadIds[0] ?? account.dmThreadId,
    firstDmAt: entry.firstDmAt ?? account.firstDmAt,
    lastDmAt: entry.lastDmAt ?? account.lastDmAt,
    dmSentByMe: entry.senderSplitAvailable
      ? entry.directDmSentByMe
      : account.dmSentByMe,
    dmSentByThem: entry.senderSplitAvailable
      ? entry.directDmSentByThem
      : account.dmSentByThem,
    dmSenderSplitAvailable: entry.senderSplitAvailable,
    dmSenderSplitConfidence: entry.senderSplitConfidence,
    dmMatchMethod: entry.matchMethod,
    nameConfidence:
      entry.matchConfidence === "high"
        ? "high"
        : account.nameConfidence ?? entry.matchConfidence,
    dataSourceNotes: [
      ...(account.dataSourceNotes ?? []).filter((n) => !n.startsWith("DM source")),
      note,
    ],
  };
}

/** Overlay canonical DM stats — exact username match only. */
export function overlayDmStatsOnAccounts(
  accounts: UnifiedAccount[],
  index: DmAccountIndex
): UnifiedAccount[] {
  return accounts.map((account) => {
    const hit = index.lookupByUsername(account.username);
    if (!hit) return account;
    return applyDmLookupToAccount(account, hit);
  });
}

export function lookupDmForAccount(
  index: DmAccountIndex,
  username: string
): DmLookupResult | null {
  return index.lookupByUsername(username);
}
