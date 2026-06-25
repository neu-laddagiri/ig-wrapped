import { formatAccountDisplayName } from "@/lib/accountNameFilter";
import {
  getCanonicalAccountKey,
  getDisplayLabel,
  getSecondaryLabel,
  isLikelyInstagramUsername,
  normalizeUsername as identityNormalizeUsername,
  usernamesMatch,
} from "@/lib/accountIdentity";
import type { CoreAnalytics, DmPersonRecord } from "@/lib/insights/coreAnalytics";
import { instagramProfileUrl, formatTimestamp } from "@/lib/formatters";
import type { UnifiedAccount, NameConfidence } from "@/types/insights";
import type { LinkedInHelperEntry, NetworkStats } from "@/types/instagram";
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

function lastActiveLabel(lastDmAt?: number): string | undefined {
  if (!lastDmAt) return undefined;
  const formatted = formatTimestamp(lastDmAt);
  return formatted === "—" ? undefined : formatted;
}

function dmFromPerson(dm: DmPersonRecord): Pick<
  CanonicalAccount,
  | "directDmCount"
  | "directDmSentByMe"
  | "directDmSentByThem"
  | "senderSplitAvailable"
  | "firstDmAt"
  | "lastDmAt"
  | "lastActiveLabel"
  | "directDmThreadId"
  | "directDmThreadIds"
  | "dmMatchMethod"
  | "dmMatchConfidence"
> {
  return {
    directDmCount: dm.directDmCount,
    directDmSentByMe: dm.senderSplitAvailable ? dm.directDmSentByMe : undefined,
    directDmSentByThem: dm.senderSplitAvailable ? dm.directDmSentByThem : undefined,
    senderSplitAvailable: dm.senderSplitAvailable,
    firstDmAt: dm.firstDmAt,
    lastDmAt: dm.lastDmAt,
    lastActiveLabel: lastActiveLabel(dm.lastDmAt),
    directDmThreadId: dm.threadIds[0],
    directDmThreadIds: [...dm.threadIds],
    dmMatchMethod: dm.matchMethod,
    dmMatchConfidence: dm.matchConfidence,
  };
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

function personToCanonical(
  dm: DmPersonRecord,
  unified?: UnifiedAccount
): CanonicalAccount {
  const username = isLikelyInstagramUsername(dm.username)
    ? identityNormalizeUsername(dm.username)
    : dm.username;
  const displayName = formatAccountDisplayName(
    unified?.displayName ?? dm.displayName
  );
  const key = dm.stableKey;
  const dmFields = dmFromPerson(dm);

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
    isUnknownAccount: dm.isUnknownOrDeleted,
    href: isLikelyInstagramUsername(username)
      ? instagramProfileUrl(username)
      : "#",
    sourceNotes: [`DM source: ${dm.directDmCount.toLocaleString()} direct messages`],
  };
}

function unifiedToCanonical(u: UnifiedAccount): CanonicalAccount {
  const username = u.username;
  const displayName = formatAccountDisplayName(u.displayName);
  const key = getCanonicalAccountKey({ username });
  const hasDm = u.dmMessageCount > 0 || u.hasDmThread;

  return {
    key,
    username,
    displayName,
    displayLabel: getDisplayLabel({ displayName, username }),
    secondaryLabel: getSecondaryLabel({ username }),
    directDmCount: hasDm ? u.dmMessageCount : 0,
    directDmSentByMe: u.dmSenderSplitAvailable ? u.dmSentByMe : undefined,
    directDmSentByThem: u.dmSenderSplitAvailable ? u.dmSentByThem : undefined,
    senderSplitAvailable: Boolean(u.dmSenderSplitAvailable),
    firstDmAt: u.firstDmAt,
    lastDmAt: u.lastDmAt,
    lastActiveLabel: lastActiveLabel(u.lastDmAt),
    directDmThreadId: u.dmThreadId,
    directDmThreadIds: u.dmThreadId ? [u.dmThreadId] : [],
    dmMatchMethod: u.dmMatchMethod,
    dmMatchConfidence: u.nameConfidence,
    ...networkFieldsFromUnified(u),
  };
}

/**
 * Build canonical accounts — DM stats from coreAnalytics.dmPeople (DMs tab source of truth).
 */
export function buildCanonicalAccountIndex(
  coreAnalytics: CoreAnalytics,
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

  for (const dm of coreAnalytics.dmPeople) {
    const unified =
      unifiedByUsername.get(dm.username) ??
      unifiedByUsername.get(identityNormalizeUsername(dm.username));
    if (unified) claimedUnified.add(unified.username);

    const canonical = personToCanonical(dm, unified);
    byKey.set(canonical.key, canonical);
    if (isLikelyInstagramUsername(canonical.username)) {
      byUsername.set(identityNormalizeUsername(canonical.username), canonical);
      byUsername.set(canonical.username, canonical);
    }
  }

  for (const u of unifiedAccounts) {
    if (claimedUnified.has(u.username)) continue;
    const norm = identityNormalizeUsername(u.username);
    if (byUsername.has(norm) || byUsername.has(u.username)) continue;

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

export function canonicalToReceiptDm(c: CanonicalAccount): AccountReceiptDm {
  return {
    hasDirectThread: c.directDmCount > 0,
    directDmCount: c.directDmCount,
    firstDmAt: c.firstDmAt,
    lastDmAt: c.lastDmAt,
    sentByMe: c.senderSplitAvailable ? c.directDmSentByMe : undefined,
    sentByThem: c.senderSplitAvailable ? c.directDmSentByThem : undefined,
    senderSplitAvailable: c.senderSplitAvailable,
    matchConfidence: c.dmMatchConfidence,
    matchSource: c.dmMatchMethod?.replace(/-/g, " "),
  };
}

export function buildReceiptFromCanonical(
  canonical: CanonicalAccount,
  linkedinEntry?: LinkedInHelperEntry
): AccountReceipt {
  return {
    username: canonical.username,
    displayName: canonical.displayLabel,
    followsMe: canonical.followsMe,
    iFollowThem: canonical.iFollowThem,
    isMutual: canonical.isMutual,
    relationshipLabel: canonical.relationshipLabel,
    recommendedAction: canonical.recommendedAction,
    isUnknownAccount: canonical.isUnknownAccount,
    dm: canonicalToReceiptDm(canonical),
  };
}

export function openAccountReceipt(
  index: CanonicalAccountIndex,
  accountKey: string,
  options?: {
    network?: NetworkStats | null;
    linkedinEntry?: LinkedInHelperEntry;
  }
): AccountReceipt | null {
  const canonical = resolveCanonicalAccount(index, accountKey);
  if (!canonical) return null;
  return buildReceiptFromCanonical(canonical, options?.linkedinEntry);
}

/** LinkedIn "why ranked" label — no negative scores. */
export function canonicalRankReason(c: CanonicalAccount): string {
  const parts: string[] = [];

  if (c.directDmCount > 0) {
    parts.push(`${c.directDmCount.toLocaleString()} direct DMs`);
    if (c.lastActiveLabel) parts.push(`active ${c.lastActiveLabel}`);
    if (c.isMutual) parts.push("mutual");
    else {
      if (c.followsMe) parts.push("follows you");
      if (c.iFollowThem) parts.push("you follow");
    }
    const likes =
      c.likesAttribution === "attributed" ? c.likedCount : 0;
    const comments =
      c.commentsAttribution === "attributed" ? c.commentedCount : 0;
    if (likes + comments > 0) {
      parts.push(`${likes + comments} matched interactions`);
    }
    return parts.join(" · ");
  }

  if (c.isMutual) {
    return "Network only · mutual · no direct DMs";
  }
  if (c.followsMe || c.iFollowThem) {
    const rel = c.followsMe && c.iFollowThem ? "mutual" : c.followsMe ? "follows you" : "you follow";
    return `Network only · ${rel} · no direct DMs`;
  }
  return "Network only · no direct DMs";
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

  const aRel = (a.followsMe ? 1 : 0) + (a.iFollowThem ? 1 : 0);
  const bRel = (b.followsMe ? 1 : 0) + (b.iFollowThem ? 1 : 0);
  if (bRel !== aRel) return bRel - aRel;

  const aEng =
    (a.likesAttribution === "attributed" ? a.likedCount : 0) +
    (a.commentsAttribution === "attributed" ? a.commentedCount : 0);
  const bEng =
    (b.likesAttribution === "attributed" ? b.likedCount : 0) +
    (b.commentsAttribution === "attributed" ? b.commentedCount : 0);
  if (bEng !== aEng) return bEng - aEng;

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
      dmSentByMe: canonical.senderSplitAvailable
        ? canonical.directDmSentByMe
        : account.dmSentByMe,
      dmSentByThem: canonical.senderSplitAvailable
        ? canonical.directDmSentByThem
        : account.dmSentByThem,
      dmSenderSplitAvailable: canonical.senderSplitAvailable,
      dmMatchMethod: (canonical.dmMatchMethod ??
        account.dmMatchMethod) as UnifiedAccount["dmMatchMethod"],
      nameConfidence:
        canonical.dmMatchConfidence ?? account.nameConfidence,
    };
  });
}
