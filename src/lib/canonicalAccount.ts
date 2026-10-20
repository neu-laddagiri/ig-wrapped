import type { UnifiedAccount, AttributionStatus, NameConfidence } from "@/types/insights";
import type { CoreAnalytics } from "@/lib/insights/coreAnalytics";
import type { InteractionExportMeta } from "@/lib/interactionExportParser";
import type { ExportOwnerIdentity } from "@/lib/exportOwnerIdentity";
import { formatAccountDisplayName } from "@/lib/accountNameFilter";
import {
  getCanonicalAccountKey,
  isLikelyInstagramUsername,
  normalizeUsername as identityNormalizeUsername,
} from "@/lib/accountIdentity";

/** Canonical account record used across every tab. */
export interface CanonicalAccountRecord {
  stableKey: string;
  displayName: string;
  username: string;
  aliases: string[];
  confidence: NameConfidence;
  isUnknownDeleted: boolean;
  dmStats: {
    directCount: number;
    sentByMe?: number;
    sentByThem?: number;
    firstAt?: number;
    lastAt?: number;
    matchMethod?: string;
    matchStatus?: UnifiedAccount["dmMatchStatus"];
    senderSplitAvailable: boolean;
    threadId?: string;
    folderPaths: string[];
  };
  interactionStats: {
    likes: number;
    likesAttribution?: AttributionStatus;
    comments: number;
    commentsAttribution?: AttributionStatus;
    stories: number;
    storiesAttribution?: AttributionStatus;
    search: number;
    searchAttribution?: AttributionStatus;
  };
  networkStats: {
    followsMe: boolean;
    iFollowThem: boolean;
    isMutual: boolean;
  };
  groupMessagesSent: number;
  sourcePaths: string[];
  dataSourceNotes: string[];
}

export interface AccountIndex {
  byStableKey: Map<string, CanonicalAccountRecord>;
  byUsername: Map<string, CanonicalAccountRecord>;
  byAlias: Map<string, CanonicalAccountRecord>;
  ownerIdentity?: ExportOwnerIdentity;
  interactionMeta?: InteractionExportMeta;
}

export function unifiedToCanonical(account: UnifiedAccount): CanonicalAccountRecord {
  const stableKey = getCanonicalAccountKey({ username: account.username });

  return {
    stableKey,
    displayName: formatAccountDisplayName(account.displayName),
    username: account.username,
    aliases: account.aliases ?? [],
    confidence: account.nameConfidence ?? "low",
    isUnknownDeleted: Boolean(account.isUnknownAccount),
    dmStats: {
      directCount: account.dmMessageCount,
      sentByMe: account.dmSenderSplitAvailable ? account.dmSentByMe : undefined,
      sentByThem: account.dmSenderSplitAvailable ? account.dmSentByThem : undefined,
      firstAt: account.firstDmAt,
      lastAt: account.lastDmAt,
      matchMethod: account.dmMatchMethod,
      matchStatus: account.dmMatchStatus,
      senderSplitAvailable: Boolean(account.dmSenderSplitAvailable),
      threadId: account.dmThreadId,
      folderPaths: [],
    },
    interactionStats: {
      likes: account.likedCount,
      likesAttribution: account.likesAttribution,
      comments: account.commentedCount,
      commentsAttribution: account.commentsAttribution,
      stories: account.storyInteractionCount,
      storiesAttribution: account.storiesAttribution,
      search: account.searchCount ?? 0,
      searchAttribution: account.searchAttribution,
    },
    networkStats: {
      followsMe: account.followsMe,
      iFollowThem: account.iFollowThem,
      isMutual: account.isMutual,
    },
    groupMessagesSent: account.groupMessageCount ?? 0,
    sourcePaths: account.sourceBreakdown?.explanations ?? [],
    dataSourceNotes: account.dataSourceNotes ?? [],
  };
}

export function buildAccountIndex(
  accounts: UnifiedAccount[],
  extras?: {
    ownerIdentity?: ExportOwnerIdentity;
    interactionMeta?: InteractionExportMeta;
  }
): AccountIndex {
  const byStableKey = new Map<string, CanonicalAccountRecord>();
  const byUsername = new Map<string, CanonicalAccountRecord>();
  const byAlias = new Map<string, CanonicalAccountRecord>();

  for (const account of accounts) {
    const canonical = unifiedToCanonical(account);
    byStableKey.set(canonical.stableKey, canonical);
    byUsername.set(account.username, canonical);
    const normUser = identityNormalizeUsername(account.username);
    if (normUser) byUsername.set(normUser, canonical);

    const aliasKeys = new Set([
      account.username,
      ...(isLikelyInstagramUsername(account.username)
        ? [identityNormalizeUsername(account.username)]
        : []),
    ]);
    for (const alias of aliasKeys) {
      if (!alias?.trim()) continue;
      byAlias.set(alias, canonical);
    }
  }

  return {
    byStableKey,
    byUsername,
    byAlias,
    ownerIdentity: extras?.ownerIdentity,
    interactionMeta: extras?.interactionMeta,
  };
}

/** Resolve by exact username only — never fuzzy or display-name match. */
export function resolveAccountIdentity(
  index: AccountIndex,
  query: string
): CanonicalAccountRecord | undefined {
  const q = query.trim();
  if (!q) return undefined;

  const norm = identityNormalizeUsername(q);
  return (
    index.byUsername.get(q) ??
    index.byUsername.get(norm) ??
    index.byStableKey.get(norm) ??
    index.byAlias.get(norm)
  );
}

export function validateDmLeaderboardParity(
  coreAnalytics: CoreAnalytics,
  leaderboardTopDm: { displayName: string; dmCount?: number }[]
): { ok: boolean; notes: string[] } {
  const notes: string[] = [];
  const dmTabTop = coreAnalytics.topDirectDmPeople.slice(0, 10);
  const boardTop = leaderboardTopDm.slice(0, 10);

  for (let i = 0; i < Math.min(dmTabTop.length, boardTop.length); i++) {
    const a = dmTabTop[i];
    const b = boardTop[i];
    if (a.directDmCount !== (b.dmCount ?? 0)) {
      notes.push(
        `Rank ${i + 1} mismatch: DMs tab ${a.displayName} (${a.directDmCount}) vs leaderboard ${b.displayName} (${b.dmCount ?? 0})`
      );
    }
  }

  return { ok: notes.length === 0, notes };
}
