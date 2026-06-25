import { instagramProfileUrl, normalizeUsername } from "@/lib/formatters";
import {
  buildDmStatsAndDebug,
  toSourceBreakdown,
} from "@/lib/dmParticipantResolution";
import type {
  DmAnalytics,
  LinkedInHelperEntry,
  NetworkStats,
} from "@/types/instagram";
import type {
  RelationshipLabel,
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

export function buildUnifiedAccounts(params: {
  network: NetworkStats | null;
  messages: DmAnalytics | null;
  linkedinProgress: LinkedInHelperEntry[];
  interactionCounts?: Map<
    string,
    { likes: number; comments: number; stories: number }
  >;
}): UnifiedAccount[] {
  const { network, messages, linkedinProgress, interactionCounts } = params;
  if (!network) return [];

  const linkedinMap = new Map(linkedinProgress.map((e) => [e.username, e]));
  const { statsByKey } = buildDmStatsAndDebug({ messages, network });

  const seen = new Map<string, UnifiedAccount>();

  const allLists = [
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

  for (const acc of allLists) {
    const username = normalizeUsername(acc.username);
    if (seen.has(username)) continue;

    const follower = network.followers.find((a) => a.username === username);
    const following = network.following.find((a) => a.username === username);
    const followsMe = Boolean(follower);
    const iFollowThem = Boolean(following);
    const isMutual = followsMe && iFollowThem;
    const followedMeAt = follower?.timestamp;
    const iFollowedAt = following?.timestamp;
    const dm = statsByKey.get(username);
    const interactions = interactionCounts?.get(username);
    const linkedin = linkedinMap.get(username);
    const interactionScore =
      (interactions?.likes ?? 0) +
      (interactions?.comments ?? 0) +
      (interactions?.stories ?? 0);

    const directDmCount = dm?.directDmCount ?? 0;
    const groupMessageCount = dm?.groupMessagesSent ?? 0;

    const isBlocked = network.blocked.some((a) => a.username === username);
    const isRestricted = network.restricted.some((a) => a.username === username);
    const isPending = network.pendingRequests.some((a) => a.username === username);
    const isRecentlyUnfollowed = network.recentlyUnfollowed.some(
      (a) => a.username === username
    );

    const relationshipLabel = deriveRelationshipLabel({
      isMutual,
      iFollowThem,
      followsMe,
      hasDmThread: Boolean(dm?.hasDirectThread),
      dmMessageCount: directDmCount,
      groupMessageCount,
      interactionScore,
      isBlocked,
      isRestricted,
      isPending,
      isRecentlyUnfollowed,
      isUnknown: false,
    });

    const likedCount = interactions?.likes ?? 0;
    const commentedCount = interactions?.comments ?? 0;
    const storyInteractionCount = interactions?.stories ?? 0;

    const sourceBreakdown = dm
      ? toSourceBreakdown(dm, {
          isMutual,
          followsMe,
          iFollowThem,
          likedCount,
          commentedCount,
          storyInteractionCount,
        })
      : undefined;

    const timestamps = [followedMeAt, iFollowedAt, dm?.lastDirectDmAt].filter(
      (t): t is number => t !== undefined
    );

    seen.set(username, {
      username,
      displayName:
        acc.displayUsername ??
        follower?.displayUsername ??
        following?.displayUsername ??
        username,
      href:
        acc.href ??
        follower?.href ??
        following?.href ??
        instagramProfileUrl(username),
      followsMe,
      iFollowThem,
      isMutual,
      followedMeAt,
      iFollowedAt,
      whoFollowedFirst: whoFollowedFirst(followedMeAt, iFollowedAt),
      followBackTimeMs: followBackTimeMs(followedMeAt, iFollowedAt),
      firstConnectedAt:
        timestamps.length > 0 ? Math.min(...timestamps) : undefined,
      becameMutualAt:
        isMutual && followedMeAt && iFollowedAt
          ? Math.max(followedMeAt, iFollowedAt)
          : undefined,
      hasDmThread: Boolean(dm?.hasDirectThread),
      dmThreadId: dm?.directThreadIds[0],
      dmMessageCount: directDmCount,
      groupMessageCount,
      lastDmAt: dm?.lastDirectDmAt,
      likedCount,
      commentedCount,
      storyInteractionCount,
      linkedInStatus: linkedin?.status,
      linkedInNotes: linkedin?.notes,
      relationshipLabel,
      recommendedAction: recommendedAction(relationshipLabel),
      isUnknownAccount: false,
      nameConfidence: dm?.confidence ?? "medium",
      sourceBreakdown,
    });
  }

  // DM-only unknown / non-network contacts
  for (const [key, dm] of statsByKey) {
    if (key.startsWith("__group__")) continue;
    if (seen.has(key)) continue;
    if (!dm.isUnknown && !dm.hasDirectThread && dm.groupMessagesSent === 0)
      continue;

    const relationshipLabel = dm.isUnknown
      ? "Unknown"
      : deriveRelationshipLabel({
          isMutual: false,
          iFollowThem: false,
          followsMe: false,
          hasDmThread: dm.hasDirectThread,
          dmMessageCount: dm.directDmCount,
          groupMessageCount: dm.groupMessagesSent,
          interactionScore: 0,
          isBlocked: false,
          isRestricted: false,
          isPending: false,
          isRecentlyUnfollowed: false,
          isUnknown: dm.isUnknown,
        });

    seen.set(key, {
      username: key,
      displayName: dm.displayName,
      href: "#",
      followsMe: false,
      iFollowThem: false,
      isMutual: false,
      whoFollowedFirst: "Unknown",
      hasDmThread: dm.hasDirectThread,
      dmThreadId: dm.directThreadIds[0],
      dmMessageCount: dm.directDmCount,
      groupMessageCount: dm.groupMessagesSent,
      lastDmAt: dm.lastDirectDmAt,
      likedCount: 0,
      commentedCount: 0,
      storyInteractionCount: 0,
      relationshipLabel,
      recommendedAction: dm.isUnknown
        ? "Instagram's export did not include a usable name — may be deleted or deactivated."
        : recommendedAction(relationshipLabel),
      isUnknownAccount: dm.isUnknown,
      nameConfidence: dm.confidence,
      sourceBreakdown: toSourceBreakdown(dm, {
        isMutual: false,
        followsMe: false,
        iFollowThem: false,
        likedCount: 0,
        commentedCount: 0,
        storyInteractionCount: 0,
      }),
    });
  }

  return Array.from(seen.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );
}

export function findUnifiedAccount(
  accounts: UnifiedAccount[],
  username: string
): UnifiedAccount | undefined {
  return accounts.find((a) => a.username === normalizeUsername(username));
}
