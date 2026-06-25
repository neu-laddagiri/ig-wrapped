import { UNKNOWN_ACCOUNT_LABEL } from "@/lib/accountNameFilter";
import {
  getDisplayLabel,
  getSecondaryLabel,
  isLikelyInstagramUsername,
  normalizeUsername,
} from "@/lib/accountIdentity";
import type { CanonicalAccount } from "@/lib/canonicalAccounts";
import {
  indexFromCanonicalList,
  resolveCanonicalAccount,
} from "@/lib/canonicalAccounts";
import {
  directDmRankReason,
  type DirectDmIndex,
  type DirectDmRecord,
} from "@/lib/insights/directDmIndex";
import { instagramProfileUrl } from "@/lib/formatters";
import type {
  InstagramAccount,
  LinkedInHelperEntry,
  LinkedInSource,
} from "@/types/instagram";

export type LinkedInSortMode =
  | "most-interacted"
  | "direct-dms"
  | "recent-dm"
  | "mutuals-first"
  | "followers"
  | "following"
  | "alphabetical"
  | "not-reviewed";

export interface BuiltLinkedInRow {
  entry: LinkedInHelperEntry;
  accountKey: string;
  threadId?: string;
  displayLabel: string;
  secondaryLabel: string;
  directDmCount: number;
  lastDmAt?: number;
  reason: string;
  dmRecord?: DirectDmRecord;
  isMutual: boolean;
  followsMe: boolean;
  iFollowThem: boolean;
  isSilentMutual: boolean;
  isUnknown: boolean;
}

function relationshipTier(row: {
  isMutual: boolean;
  followsMe: boolean;
  iFollowThem: boolean;
}): number {
  if (row.isMutual) return 3;
  if (row.followsMe || row.iFollowThem) return 2;
  return 0;
}

function networkFields(
  canonical: CanonicalAccount | undefined,
  networkAccount: InstagramAccount | undefined
): Pick<
  BuiltLinkedInRow,
  "isMutual" | "followsMe" | "iFollowThem"
> {
  const cat = networkAccount?.category?.toLowerCase() ?? "";
  return {
    isMutual: canonical?.isMutual ?? cat.includes("mutual"),
    followsMe:
      canonical?.followsMe ??
      (cat.includes("follower") || cat.includes("mutual")),
    iFollowThem:
      canonical?.iFollowThem ??
      (cat.includes("following") || cat.includes("mutual")),
  };
}

function lookupStoredEntry(
  progressKey: string,
  legacyKeys: string[],
  entryByKey: Map<string, LinkedInHelperEntry>
): LinkedInHelperEntry | undefined {
  const direct = entryByKey.get(progressKey);
  if (direct) return direct;
  for (const key of legacyKeys) {
    if (!key || key === progressKey) continue;
    const hit = entryByKey.get(key) ?? entryByKey.get(normalizeUsername(key));
    if (hit) return hit;
  }
  return undefined;
}

function defaultEntry(
  progressKey: string,
  displayUsername: string,
  networkAccount?: InstagramAccount
): LinkedInHelperEntry {
  return {
    username: progressKey,
    displayUsername,
    instagramHref:
      networkAccount?.href ?? instagramProfileUrl(progressKey),
    status: "not-reviewed",
    notes: "",
    category: networkAccount?.category,
  };
}

function mergeEntry(
  progressKey: string,
  legacyKeys: string[],
  entryByKey: Map<string, LinkedInHelperEntry>,
  networkAccount?: InstagramAccount,
  displayUsername?: string
): LinkedInHelperEntry {
  const stored = lookupStoredEntry(progressKey, legacyKeys, entryByKey);
  if (stored) {
    return { ...stored, username: progressKey };
  }
  return defaultEntry(
    progressKey,
    displayUsername ?? networkAccount?.displayUsername ?? progressKey,
    networkAccount
  );
}

function buildDmRow(
  dmRecord: DirectDmRecord,
  canonical: CanonicalAccount | undefined,
  networkAccount: InstagramAccount | undefined,
  entryByKey: Map<string, LinkedInHelperEntry>
): BuiltLinkedInRow {
  const networkUsername =
    canonical?.username &&
    isLikelyInstagramUsername(canonical.username)
      ? canonical.username
      : dmRecord.username && isLikelyInstagramUsername(dmRecord.username)
        ? normalizeUsername(dmRecord.username)
        : undefined;

  const progressKey = dmRecord.accountKey;
  const legacyKeys = [networkUsername, dmRecord.username].filter(
    (k): k is string => Boolean(k)
  );
  const net = networkFields(canonical, networkAccount);
  const displayName =
    dmRecord.displayName ??
    canonical?.displayName ??
    networkAccount?.displayUsername ??
    UNKNOWN_ACCOUNT_LABEL;
  const usernameForLabel = networkUsername ?? dmRecord.username;

  const displayLabel = getDisplayLabel({
    displayName,
    username: usernameForLabel ?? progressKey,
  });
  const secondaryLabel = usernameForLabel
    ? getSecondaryLabel({ username: usernameForLabel })
    : canonical?.secondaryLabel ?? progressKey;

  const entry = mergeEntry(
    progressKey,
    legacyKeys,
    entryByKey,
    networkAccount,
    displayName
  );

  return {
    entry,
    accountKey: dmRecord.accountKey,
    threadId: dmRecord.threadId,
    displayLabel,
    secondaryLabel,
    directDmCount: dmRecord.totalMessages,
    lastDmAt: dmRecord.lastDmAt,
    reason: directDmRankReason(dmRecord, net.isMutual),
    dmRecord,
    ...net,
    isSilentMutual: false,
    isUnknown:
      displayName === UNKNOWN_ACCOUNT_LABEL ||
      progressKey.startsWith("unknown:"),
  };
}

function buildNetworkOnlyRow(
  networkAccount: InstagramAccount,
  canonical: CanonicalAccount | undefined,
  entryByKey: Map<string, LinkedInHelperEntry>
): BuiltLinkedInRow {
  const net = networkFields(canonical, networkAccount);
  const displayLabel =
    canonical?.displayLabel ??
    getDisplayLabel({
      displayName: networkAccount.displayUsername,
      username: networkAccount.username,
    });
  const secondaryLabel =
    canonical?.secondaryLabel ??
    getSecondaryLabel({ username: networkAccount.username });

  const progressKey = canonical?.key ?? networkAccount.username;

  return {
    entry: mergeEntry(
      progressKey,
      [networkAccount.username],
      entryByKey,
      networkAccount
    ),
    accountKey: progressKey,
    displayLabel,
    secondaryLabel,
    directDmCount: 0,
    reason: directDmRankReason(undefined, net.isMutual),
    ...net,
    isSilentMutual: net.isMutual,
    isUnknown:
      canonical?.isUnknownAccount ||
      networkAccount.username.startsWith("unknown:"),
  };
}

/**
 * DM contacts first (same records as DMs tab / Real Ones), then network-only.
 */
export function buildLinkedInHelperRows(params: {
  directDmIndex: DirectDmIndex;
  canonicalAccounts: CanonicalAccount[];
  sourceAccounts: InstagramAccount[];
  source: LinkedInSource;
  entryByKey: Map<string, LinkedInHelperEntry>;
}): BuiltLinkedInRow[] {
  const { directDmIndex, canonicalAccounts, sourceAccounts, source, entryByKey } =
    params;

  const canonicalIndex = indexFromCanonicalList(canonicalAccounts);
  const networkByUsername = new Map<string, InstagramAccount>();
  for (const a of sourceAccounts) {
    networkByUsername.set(a.username, a);
    networkByUsername.set(normalizeUsername(a.username), a);
  }

  const rows: BuiltLinkedInRow[] = [];
  const coveredNetworkUsernames = new Set<string>();

  for (const dmRecord of directDmIndex.records) {
    const canonical =
      resolveCanonicalAccount(canonicalIndex, dmRecord.accountKey) ??
      (dmRecord.username
        ? resolveCanonicalAccount(canonicalIndex, dmRecord.username)
        : undefined);

    const networkUsername =
      canonical?.username && networkByUsername.has(canonical.username)
        ? canonical.username
        : dmRecord.username && networkByUsername.has(dmRecord.username)
          ? normalizeUsername(dmRecord.username)
          : dmRecord.username &&
              networkByUsername.has(normalizeUsername(dmRecord.username))
            ? normalizeUsername(dmRecord.username)
            : undefined;

    if (!networkUsername && source !== "all") continue;

    const networkAccount = networkUsername
      ? networkByUsername.get(networkUsername)
      : undefined;

    rows.push(
      buildDmRow(dmRecord, canonical, networkAccount, entryByKey)
    );

    if (networkUsername) {
      coveredNetworkUsernames.add(networkUsername);
    }
  }

  for (const networkAccount of sourceAccounts) {
    if (coveredNetworkUsernames.has(networkAccount.username)) continue;

    const canonical =
      resolveCanonicalAccount(canonicalIndex, networkAccount.username) ??
      canonicalIndex.byUsername.get(networkAccount.username);

    rows.push(
      buildNetworkOnlyRow(networkAccount, canonical, entryByKey)
    );
  }

  return rows;
}

export function compareLinkedInRows(
  a: BuiltLinkedInRow,
  b: BuiltLinkedInRow,
  sortMode: LinkedInSortMode
): number {
  switch (sortMode) {
    case "alphabetical":
      return a.displayLabel.localeCompare(b.displayLabel);
    case "direct-dms":
      return b.directDmCount - a.directDmCount;
    case "recent-dm": {
      const aTs = a.lastDmAt ?? 0;
      const bTs = b.lastDmAt ?? 0;
      return bTs - aTs;
    }
    case "mutuals-first": {
      const aM = a.isMutual ? 1 : 0;
      const bM = b.isMutual ? 1 : 0;
      if (bM !== aM) return bM - aM;
      return compareLinkedInRows(a, b, "most-interacted");
    }
    case "followers": {
      const aF = a.followsMe ? 1 : 0;
      const bF = b.followsMe ? 1 : 0;
      if (bF !== aF) return bF - aF;
      return compareLinkedInRows(a, b, "most-interacted");
    }
    case "following": {
      const aF = a.iFollowThem ? 1 : 0;
      const bF = b.iFollowThem ? 1 : 0;
      if (bF !== aF) return bF - aF;
      return compareLinkedInRows(a, b, "most-interacted");
    }
    case "not-reviewed": {
      const aN = a.entry.status === "not-reviewed" ? 1 : 0;
      const bN = b.entry.status === "not-reviewed" ? 1 : 0;
      if (bN !== aN) return bN - aN;
      return compareLinkedInRows(a, b, "most-interacted");
    }
    case "most-interacted":
    default: {
      if (b.directDmCount !== a.directDmCount) {
        return b.directDmCount - a.directDmCount;
      }
      const aTs = a.lastDmAt ?? 0;
      const bTs = b.lastDmAt ?? 0;
      if (bTs !== aTs) return bTs - aTs;

      const aRel = relationshipTier(a);
      const bRel = relationshipTier(b);
      if (bRel !== aRel) return bRel - aRel;

      const aUser = a.entry.username;
      const bUser = b.entry.username;
      return aUser.localeCompare(bUser);
    }
  }
}
