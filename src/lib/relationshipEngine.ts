import { instagramProfileUrl } from "@/lib/formatters";
import { formatAccountDisplayName } from "@/lib/accountNameFilter";
import {
  buildIdentityGraph,
  toSourceBreakdownFromPerson,
  type IdentityGraph,
} from "@/lib/identityResolver";
import { usernamesMatch, normalizeUsername as identityNormalizeUsername } from "@/lib/accountIdentity";
import type {
  DmAnalytics,
  LinkedInHelperEntry,
  NetworkStats,
} from "@/types/instagram";
import type {
  RelationshipLabel,
  SearchWrappedResult,
  UnifiedAccount,
  WhoFollowedFirst,
} from "@/types/insights";

const DAY_MS = 24 * 60 * 60 * 1000;

function whoFollowedFirst(
  followedMeAt?: number,
  iFollowedAt?: number
): WhoFollowedFirst {
  if (!followedMeAt || !iFollowedAt) return "Unknown";
  const diff = Math.abs(followedMeAt - iFollowedAt);
  if (diff < DAY_MS) return "Same day";
  return followedMeAt < iFollowedAt ? "Them" : "Me";
}

function followBackTimeMs(
  followedMeAt?: number,
  iFollowedAt?: number
): number | undefined {
  if (!followedMeAt || !iFollowedAt) return undefined;
  return Math.abs(iFollowedAt - followedMeAt);
}

function deriveRelationshipLabel(account: {
  isMutual: boolean;
  iFollowThem: boolean;
  followsMe: boolean;
  hasDmThread: boolean;
  dmMessageCount: number;
  groupMessageCount: number;
  interactionScore: number;
  isBlocked: boolean;
  isRestricted: boolean;
  isPending: boolean;
  isRecentlyUnfollowed: boolean;
  isUnknown: boolean;
}): RelationshipLabel {
  if (account.isUnknown) return "Unknown";
  if (account.isBlocked || account.isRestricted) return "Blocked/restricted";
  if (account.isPending) return "Pending request";
  if (account.isRecentlyUnfollowed) return "Recently unfollowed";
  if (account.hasDmThread && account.dmMessageCount > 50) return "DM friend";
  if (
    account.isMutual &&
    account.dmMessageCount === 0 &&
    account.groupMessageCount < 3 &&
    account.interactionScore === 0
  ) {
    return "Silent mutual";
  }
  if (account.isMutual) return "Mutual";
  if (account.iFollowThem && !account.followsMe)
    return "You follow them, they do not follow back";
  if (account.followsMe && !account.iFollowThem)
    return "They follow you, you do not follow back";
  if (account.iFollowThem && !account.hasDmThread) return "Dead follow";
  return "Unknown";
}

function recommendedAction(label: RelationshipLabel): string {
  switch (label) {
    case "You follow them, they do not follow back":
      return "Consider unfollowing if you don't interact.";
    case "They follow you, you do not follow back":
      return "Follow back if you know them.";
    case "DM friend":
      return "Keep — active conversation.";
    case "Silent mutual":
      return "No action needed unless you want to reach out.";
    case "Dead follow":
      return "Review for cleanup — no DMs or interactions.";
    case "Blocked/restricted":
      return "Account is blocked or restricted.";
    case "Pending request":
      return "Review pending follow request.";
    default:
      return "No action needed.";
  }
}

export function buildSearchMap(
  searchWrapped: SearchWrappedResult | null | undefined
): Map<string, number> | undefined {
  if (!searchWrapped?.topAccounts?.length) return undefined;
  const map = new Map<string, number>();
  for (const entry of searchWrapped.topAccounts) {
    if (entry.type !== "account") continue;
    const q = entry.query.trim();
    if (!q) continue;
    map.set(q.toLowerCase(), entry.count);
    map.set(q.toLowerCase().replace(/^@/, ""), entry.count);
  }
  return map;
}

function buildDataSourceNotes(
  person: import("@/lib/identityResolver").CanonicalPerson
): string[] {
  const notes: string[] = [];
  notes.push("Network: followers/following export");

  if (person.dm.status === "matched") {
    notes.push(
      `DM match: ${person.dm.directDmCount.toLocaleString()} messages via ${person.dm.matchMethod?.replace(/-/g, " ") ?? "thread"} (${person.dm.matchConfidence} confidence)`
    );
  } else if (person.dm.status === "possible") {
    notes.push(
      `DM possible match: thread "${person.dm.matchedThreadTitle ?? "unknown"}" — review alias`
    );
  } else {
    notes.push("DM: no direct 1:1 thread matched");
  }

  if (person.likesAttribution === "not_in_export") {
    notes.push("Likes: not included in this Instagram export");
  } else if (person.likesAttribution === "not_account_level") {
    notes.push(
      "Likes: export present but Instagram does not provide account-level data for this category"
    );
  } else if (person.likesAttribution === "not_matched") {
    notes.push("Likes: export present but not matched to this account");
  } else if (person.likedCount > 0) {
    notes.push(`Likes: ${person.likedCount} attributed`);
  }

  if (person.commentsAttribution === "not_in_export") {
    notes.push("Comments: not included in this Instagram export");
  } else if (person.commentsAttribution === "not_account_level") {
    notes.push(
      "Comments: export present but Instagram does not provide account-level data for this category"
    );
  } else if (person.commentsAttribution === "not_matched") {
    notes.push("Comments: export present but not matched");
  } else if (person.commentedCount > 0) {
    notes.push(`Comments: ${person.commentedCount} attributed`);
  }

  if (person.storiesAttribution === "not_in_export") {
    notes.push("Story interactions: not included in this Instagram export");
  } else if (person.storiesAttribution === "not_account_level") {
    notes.push(
      "Story interactions: export present but no account-level data in this export"
    );
  } else if (person.storiesAttribution === "not_matched") {
    notes.push("Story interactions: not matched");
  }

  if (person.groupMessagesSent > 0) {
    notes.push(
      `Group chat: ${person.groupMessagesSent} sender messages (weak signal)`
    );
  }

  return notes;
}

export function buildUnifiedAccountsFromGraph(params: {
  graph: IdentityGraph;
  network: NetworkStats;
  linkedinProgress: LinkedInHelperEntry[];
}): UnifiedAccount[] {
  const { graph, network, linkedinProgress } = params;
  const linkedinMap = new Map(linkedinProgress.map((e) => [e.username, e]));

  const isBlocked = (username: string) =>
    network.blocked.some((a) => a.username === username);
  const isRestricted = (username: string) =>
    network.restricted.some((a) => a.username === username);
  const isPending = (username: string) =>
    network.pendingRequests.some((a) => a.username === username);
  const isRecentlyUnfollowed = (username: string) =>
    network.recentlyUnfollowed.some((a) => a.username === username);

  const accounts: UnifiedAccount[] = [];

  for (const person of graph.persons.values()) {
    if (person.canonicalId.startsWith("__group__")) continue;

    const linkedin = linkedinMap.get(person.username);
    const interactionScore =
      person.likedCount + person.commentedCount + person.storyInteractionCount;

    const relationshipLabel = deriveRelationshipLabel({
      isMutual: person.isMutual,
      iFollowThem: person.iFollowThem,
      followsMe: person.followsMe,
      hasDmThread:
        person.dm.status === "matched" || person.dm.status === "possible",
      dmMessageCount: person.dm.directDmCount,
      groupMessageCount: person.groupMessagesSent,
      interactionScore,
      isBlocked: isBlocked(person.username),
      isRestricted: isRestricted(person.username),
      isPending: isPending(person.username),
      isRecentlyUnfollowed: isRecentlyUnfollowed(person.username),
      isUnknown: person.isUnknownOrDeleted,
    });

    const timestamps = [
      person.followedMeAt,
      person.iFollowedAt,
      person.dm.lastDmAt,
    ].filter((t): t is number => t !== undefined);

    accounts.push({
      username: person.username,
      displayName: formatAccountDisplayName(person.displayName),
      href: person.isUnknownOrDeleted
        ? "#"
        : instagramProfileUrl(person.username),
      followsMe: person.followsMe,
      iFollowThem: person.iFollowThem,
      isMutual: person.isMutual,
      followedMeAt: person.followedMeAt,
      iFollowedAt: person.iFollowedAt,
      whoFollowedFirst: whoFollowedFirst(
        person.followedMeAt,
        person.iFollowedAt
      ),
      followBackTimeMs: followBackTimeMs(
        person.followedMeAt,
        person.iFollowedAt
      ),
      firstConnectedAt:
        timestamps.length > 0 ? Math.min(...timestamps) : undefined,
      becameMutualAt:
        person.isMutual && person.followedMeAt && person.iFollowedAt
          ? Math.max(person.followedMeAt, person.iFollowedAt)
          : undefined,
      hasDmThread:
        person.dm.status === "matched" || person.dm.status === "possible",
      dmThreadId: person.dm.threadIds[0],
      dmMessageCount: person.dm.directDmCount,
      groupMessageCount: person.groupMessagesSent,
      lastDmAt: person.dm.lastDmAt,
      firstDmAt: person.dm.firstDmAt,
      dmSentByMe: person.dm.directDmSentByMe,
      dmSentByThem: person.dm.directDmSentByThem,
      dmSenderSplitAvailable: person.dm.senderSplitAvailable,
      dmSenderSplitConfidence: person.dm.senderSplitConfidence,
      dmMatchStatus: person.dm.status,
      dmMatchMethod: person.dm.matchMethod,
      likedCount: person.likedCount,
      likesAttribution: person.likesAttribution,
      commentedCount: person.commentedCount,
      commentsAttribution: person.commentsAttribution,
      storyInteractionCount: person.storyInteractionCount,
      storiesAttribution: person.storiesAttribution,
      searchCount: person.searchCount,
      searchAttribution: person.searchAttribution,
      linkedInStatus: linkedin?.status,
      linkedInNotes: linkedin?.notes,
      relationshipLabel,
      recommendedAction: person.isUnknownOrDeleted
        ? "Instagram's export did not include a usable name — may be deleted or deactivated."
        : recommendedAction(relationshipLabel),
      isUnknownAccount: person.isUnknownOrDeleted,
      nameConfidence: person.dm.matchConfidence || person.confidence,
      sourceBreakdown: toSourceBreakdownFromPerson(person),
      aliases: person.aliases,
      dataSourceNotes: buildDataSourceNotes(person),
    });
  }

  return accounts.sort((a, b) => {
    if (b.dmMessageCount !== a.dmMessageCount) {
      return b.dmMessageCount - a.dmMessageCount;
    }
    return a.displayName.localeCompare(b.displayName);
  });
}

export function buildUnifiedAccounts(params: {
  network: NetworkStats | null;
  messages: DmAnalytics | null;
  linkedinProgress: LinkedInHelperEntry[];
  interactionCounts?: Map<
    string,
    { likes: number; comments: number; stories: number; saves: number }
  >;
  interactionMeta?: import("@/lib/interactionExportParser").InteractionExportMeta;
  searchWrapped?: SearchWrappedResult | null;
  graph?: IdentityGraph;
  coreAnalytics?: import("@/lib/insights/coreAnalytics").CoreAnalytics;
  files?: Map<string, string>;
}): UnifiedAccount[] {
  const {
    network,
    messages,
    linkedinProgress,
    interactionCounts,
    interactionMeta,
    searchWrapped,
    graph: graphInput,
    coreAnalytics,
    files,
  } = params;
  if (!network) return [];

  const searchByUsername = buildSearchMap(searchWrapped);

  const graph =
    graphInput ??
    buildIdentityGraph({
      network,
      messages,
      interactionCounts,
      interactionMeta,
      searchByUsername,
      hasSearchExport: Boolean(searchWrapped?.topAccounts?.length),
      coreAnalytics,
      files,
    });

  return buildUnifiedAccountsFromGraph({ graph, network, linkedinProgress });
}

export function findUnifiedAccount(
  accounts: UnifiedAccount[],
  username: string
): UnifiedAccount | undefined {
  const norm = identityNormalizeUsername(username);
  return accounts.find(
    (a) =>
      a.username === username ||
      usernamesMatch(a.username, norm) ||
      identityNormalizeUsername(a.username) === norm
  );
}
