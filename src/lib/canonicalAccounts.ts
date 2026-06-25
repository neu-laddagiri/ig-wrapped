import {
  formatAccountDisplayName,
  UNKNOWN_ACCOUNT_LABEL,
} from "@/lib/accountNameFilter";
import {
  getCanonicalAccountKey,
  getDisplayLabel,
  getSecondaryLabel,
  isLikelyInstagramUsername,
  normalizeUsername as identityNormalizeUsername,
} from "@/lib/accountIdentity";
import type { DirectDmIndex, DirectDmRecord } from "@/lib/insights/directDmIndex";
import {
  directDmRankReason,
  resolveDirectDmRecord,
} from "@/lib/insights/directDmIndex";
import { instagramProfileUrl, formatTimestamp } from "@/lib/formatters";
import type { UnifiedAccount, NameConfidence } from "@/types/insights";
import type { LinkedInHelperEntry } from "@/types/instagram";
import type { AccountReceipt, AccountReceiptDm } from "@/lib/accountReceipt";

/** Single source of truth for account identity + DM stats across all tabs. */
export interface CanonicalAccount {
  key: string;
  username: string;
  displayName: string;
  displayLabel: string;
  secondaryLabel: string;
  directDmThreadId?: string;
  directDmThreadIds: string[];
  directDmCount: number;
  directDmSentByMe?: number;
  directDmSentByThem?: number;
  senderSplitAvailable: boolean;
  firstDmAt?: number;
  lastDmAt?: number;
  lastActiveLabel?: string;
  dmMatchMethod?: string;
  dmMatchConfidence?: NameConfidence;
  isMutual: boolean;
  followsMe: boolean;
  iFollowThem: boolean;
  likedCount: number;
  likesAttribution?: UnifiedAccount["likesAttribution"];
  commentedCount: number;
  commentsAttribution?: UnifiedAccount["commentsAttribution"];
  storyInteractionCount: number;
  storiesAttribution?: UnifiedAccount["storiesAttribution"];
  groupMessageCount: number;
  isUnknownAccount: boolean;
  relationshipLabel?: string;
  recommendedAction?: string;
  href: string;
  sourceNotes: string[];
}

export interface CanonicalAccountIndex {
  accounts: CanonicalAccount[];
  byKey: Map<string, CanonicalAccount>;
  byUsername: Map<string, CanonicalAccount>;
}

export type AccountReceiptTarget =
  | string
  | { accountKey?: string; threadId?: string };

function lastActiveLabel(lastDmAt?: number): string | undefined {
  if (!lastDmAt) return undefined;
  const formatted = formatTimestamp(lastDmAt);
  return formatted === "—" ? undefined : formatted;
}

function networkFieldsFromUnified(u: UnifiedAccount): Pick<
  CanonicalAccount,
  | "isMutual"
  | "followsMe"
  | "iFollowThem"
  | "likedCount"
  | "likesAttribution"
  | "commentedCount"
  | "commentsAttribution"
  | "storyInteractionCount"
  | "storiesAttribution"
  | "groupMessageCount"
  | "isUnknownAccount"
  | "relationshipLabel"
  | "recommendedAction"
  | "href"
  | "sourceNotes"
> {
  return {
    isMutual: u.isMutual,
    followsMe: u.followsMe,
    iFollowThem: u.iFollowThem,
    likedCount: u.likedCount,
    likesAttribution: u.likesAttribution,
    commentedCount: u.commentedCount,
    commentsAttribution: u.commentsAttribution,
    storyInteractionCount: u.storyInteractionCount,
    storiesAttribution: u.storiesAttribution,
    groupMessageCount: u.groupMessageCount ?? 0,
    isUnknownAccount: Boolean(u.isUnknownAccount),
    relationshipLabel: u.relationshipLabel,
    recommendedAction: u.recommendedAction,
    href: u.href,
    sourceNotes: u.dataSourceNotes ?? [],
  };
}

function unifiedToCanonical(u: UnifiedAccount): CanonicalAccount {
  const username = u.username;
  const displayName = formatAccountDisplayName(u.displayName);
  const key = getCanonicalAccountKey({ username });

  return {
    key,
    username,
    displayName,
    displayLabel: getDisplayLabel({ displayName, username }),
    secondaryLabel: getSecondaryLabel({ username }),
    directDmCount: 0,
    senderSplitAvailable: false,
    directDmThreadIds: [],
    dmMatchConfidence: u.nameConfidence,
    ...networkFieldsFromUnified(u),
  };
}

function directRecordToCanonical(
  dm: DirectDmRecord,
  unified?: UnifiedAccount
): CanonicalAccount {
  const username = dm.username ?? dm.accountKey;
  const displayName = formatAccountDisplayName(
    unified?.displayName ?? dm.displayName
  );
  const key = dm.accountKey;

  const dmFields = {
    directDmCount: dm.totalMessages,
    directDmSentByMe: undefined,
    directDmSentByThem: undefined,
    senderSplitAvailable: false,
    firstDmAt: dm.firstDmAt,
    lastDmAt: dm.lastDmAt,
    lastActiveLabel: lastActiveLabel(dm.lastDmAt),
    directDmThreadId: dm.threadId,
    directDmThreadIds: [dm.threadId],
    dmMatchMethod: "dm-thread",
    dmMatchConfidence: "high" as NameConfidence,
  };

  if (unified) {
    return {
      key,
      username,
      displayName,
      displayLabel: getDisplayLabel({ displayName, username }),
      secondaryLabel: getSecondaryLabel({ username }),
      ...dmFields,
      ...networkFieldsFromUnified(unified),
    };
  }

  return {
    key,
    username,
    displayName,
    displayLabel: getDisplayLabel({ displayName, username }),
    secondaryLabel: getSecondaryLabel({ username }),
    ...dmFields,
    isMutual: false,
    followsMe: false,
    iFollowThem: false,
    likedCount: 0,
    commentedCount: 0,
    storyInteractionCount: 0,
    groupMessageCount: 0,
    isUnknownAccount: displayName === UNKNOWN_ACCOUNT_LABEL,
    href: isLikelyInstagramUsername(username)
      ? instagramProfileUrl(username)
      : "#",
    sourceNotes: [
      `DM source of truth: ${dm.totalMessages.toLocaleString()} direct messages`,
    ],
  };
}

/** Build canonical accounts — direct DM stats from DMs tab index only. */
export function buildCanonicalAccountIndex(
  directDmIndex: DirectDmIndex,
  unifiedAccounts: UnifiedAccount[]
): CanonicalAccountIndex {
  const byKey = new Map<string, CanonicalAccount>();
  const byUsername = new Map<string, CanonicalAccount>();

  const unifiedByUsername = new Map<string, UnifiedAccount>();
  for (const u of unifiedAccounts) {
    unifiedByUsername.set(u.username, u);
    const norm = identityNormalizeUsername(u.username);
    if (norm) unifiedByUsername.set(norm, u);
  }

  const claimedUnified = new Set<string>();

  for (const dm of directDmIndex.records) {
    const unified =
      unifiedByUsername.get(dm.accountKey) ??
      (dm.username
        ? unifiedByUsername.get(identityNormalizeUsername(dm.username))
        : undefined);
    if (unified) claimedUnified.add(unified.username);

    const canonical = directRecordToCanonical(dm, unified);
    byKey.set(canonical.key, canonical);
    byUsername.set(canonical.username, canonical);
    const norm = identityNormalizeUsername(canonical.username);
    if (norm) byUsername.set(norm, canonical);
  }

  for (const u of unifiedAccounts) {
    if (claimedUnified.has(u.username)) continue;
    const norm = identityNormalizeUsername(u.username);
    if (byUsername.has(u.username) || (norm && byUsername.has(norm))) continue;

    const canonical = unifiedToCanonical(u);
    if (!byKey.has(canonical.key)) {
      byKey.set(canonical.key, canonical);
    }
    byUsername.set(u.username, canonical);
    if (norm) byUsername.set(norm, canonical);
  }

  const accounts = [...byKey.values()].sort(
    (a, b) => b.directDmCount - a.directDmCount
  );

  return { accounts, byKey, byUsername };
}

export function indexFromCanonicalList(
  accounts: CanonicalAccount[]
): CanonicalAccountIndex {
  const byKey = new Map<string, CanonicalAccount>();
  const byUsername = new Map<string, CanonicalAccount>();
  for (const c of accounts) {
    byKey.set(c.key, c);
    byUsername.set(c.username, c);
    const norm = identityNormalizeUsername(c.username);
    if (norm) byUsername.set(norm, c);
  }
  return { accounts, byKey, byUsername };
}

export function resolveCanonicalAccount(
  index: CanonicalAccountIndex,
  accountKey: string
): CanonicalAccount | undefined {
  const trimmed = accountKey.trim();
  if (!trimmed) return undefined;
  return (
    index.byKey.get(trimmed) ??
    index.byUsername.get(trimmed) ??
    index.byUsername.get(identityNormalizeUsername(trimmed))
  );
}

export function dmRecordToReceiptDm(
  record?: DirectDmRecord
): AccountReceiptDm {
  if (!record) {
    return {
      hasDirectThread: false,
      directDmCount: 0,
      senderSplitAvailable: false,
      lookupStatus: "not-found",
    };
  }
  return {
    hasDirectThread: true,
    directDmCount: record.totalMessages,
    firstDmAt: record.firstDmAt,
    lastDmAt: record.lastDmAt,
    senderSplitAvailable: false,
    matchConfidence: "high",
    matchSource: "DM thread source of truth",
    lookupStatus: "matched",
  };
}

export function canonicalToReceiptDm(c: CanonicalAccount): AccountReceiptDm {
  return {
    hasDirectThread: c.directDmCount > 0,
    directDmCount: c.directDmCount,
    firstDmAt: c.firstDmAt,
    lastDmAt: c.lastDmAt,
    senderSplitAvailable: false,
    matchConfidence: c.dmMatchConfidence ?? "high",
    matchSource: "DM thread source of truth",
    lookupStatus: c.directDmCount > 0 ? "matched" : "not-found",
  };
}

export function buildReceiptFromCanonical(
  canonical: CanonicalAccount,
  dmOverride?: AccountReceiptDm,
  linkedinEntry?: LinkedInHelperEntry
): AccountReceipt {
  void linkedinEntry;
  return {
    username: canonical.username,
    displayName: canonical.displayLabel,
    followsMe: canonical.followsMe,
    iFollowThem: canonical.iFollowThem,
    isMutual: canonical.isMutual,
    relationshipLabel: canonical.relationshipLabel,
    recommendedAction: canonical.recommendedAction,
    isUnknownAccount: canonical.isUnknownAccount,
    dm: dmOverride ?? canonicalToReceiptDm(canonical),
  };
}

export function openAccountReceipt(params: {
  directDmIndex: DirectDmIndex;
  canonicalIndex: CanonicalAccountIndex;
  accountKey?: string;
  threadId?: string;
  linkedinEntry?: LinkedInHelperEntry;
}): AccountReceipt | null {
  const { directDmIndex, canonicalIndex, accountKey, threadId, linkedinEntry } =
    params;

  const dmRecord = resolveDirectDmRecord(directDmIndex, {
    threadId,
    accountKey,
  });

  const resolvedKey =
    accountKey?.trim() ?? dmRecord?.accountKey ?? threadId ?? "";
  const canonical = resolvedKey
    ? resolveCanonicalAccount(canonicalIndex, resolvedKey)
    : undefined;

  if (!canonical && !dmRecord) return null;

  const dmSlice = dmRecordToReceiptDm(dmRecord);

  if (canonical) {
    return buildReceiptFromCanonical(canonical, dmSlice, linkedinEntry);
  }

  if (dmRecord) {
    return {
      username: dmRecord.username ?? dmRecord.accountKey,
      displayName: getDisplayLabel({
        displayName: dmRecord.displayName,
        username: dmRecord.username ?? dmRecord.accountKey,
      }),
      followsMe: false,
      iFollowThem: false,
      isMutual: false,
      isUnknownAccount: dmRecord.displayName === UNKNOWN_ACCOUNT_LABEL,
      dm: dmSlice,
    };
  }

  return null;
}

export function canonicalRankReason(c: CanonicalAccount): string {
  return directDmRankReason(
    {
      threadId: c.directDmThreadId ?? c.key,
      accountKey: c.key,
      displayName: c.displayName,
      username: c.username,
      aliases: [],
      totalMessages: c.directDmCount,
      lastDmAt: c.lastDmAt,
      source: "dm-thread",
      confidence: "high",
    },
    c.isMutual
  );
}

export function compareCanonicalForLinkedIn(
  a: CanonicalAccount,
  b: CanonicalAccount
): number {
  const dmDiff = b.directDmCount - a.directDmCount;
  if (dmDiff !== 0) return dmDiff;

  const aTs = a.lastDmAt ?? 0;
  const bTs = b.lastDmAt ?? 0;
  if (bTs !== aTs) return bTs - aTs;

  const aMutual = a.isMutual ? 1 : 0;
  const bMutual = b.isMutual ? 1 : 0;
  if (bMutual !== aMutual) return bMutual - aMutual;

  return a.displayLabel.localeCompare(b.displayLabel);
}

export function syncUnifiedDmFromCanonical(
  accounts: UnifiedAccount[],
  index: CanonicalAccountIndex
): UnifiedAccount[] {
  return accounts.map((account) => {
    const canonical = resolveCanonicalAccount(index, account.username);
    if (!canonical || canonical.directDmCount <= 0) return account;
    if (
      account.dmMessageCount === canonical.directDmCount &&
      account.hasDmThread
    ) {
      return account;
    }
    return {
      ...account,
      hasDmThread: true,
      dmMessageCount: canonical.directDmCount,
      dmThreadId: canonical.directDmThreadId ?? account.dmThreadId,
      firstDmAt: canonical.firstDmAt ?? account.firstDmAt,
      lastDmAt: canonical.lastDmAt ?? account.lastDmAt,
      dmSenderSplitAvailable: false,
      dmMatchMethod: "folder-path" as UnifiedAccount["dmMatchMethod"],
      nameConfidence: "high",
    };
  });
}

export function normalizeReceiptTarget(
  target: AccountReceiptTarget
): { accountKey?: string; threadId?: string } {
  if (typeof target === "string") {
    return { accountKey: target.trim() };
  }
  return {
    accountKey: target.accountKey?.trim(),
    threadId: target.threadId?.trim(),
  };
}
