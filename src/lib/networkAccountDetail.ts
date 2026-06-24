import type {
  AccountNetworkDetail,
  InstagramAccount,
  LinkedInHelperEntry,
  NetworkStats,
} from "@/types/instagram";
import { instagramProfileUrl, normalizeUsername } from "@/lib/formatters";

function findAccount(
  list: InstagramAccount[],
  username: string
): InstagramAccount | undefined {
  return list.find((a) => a.username === username);
}

export function buildAccountNetworkDetail(
  network: NetworkStats,
  username: string,
  linkedinEntry?: LinkedInHelperEntry
): AccountNetworkDetail | null {
  const normalized = normalizeUsername(username);
  const follower = findAccount(network.followers, normalized);
  const following = findAccount(network.following, normalized);
  const pending = findAccount(network.pendingRequests, normalized);
  const recentReq = findAccount(network.recentFollowRequests, normalized);
  const unfollowed = findAccount(network.recentlyUnfollowed, normalized);
  const blocked = findAccount(network.blocked, normalized);
  const restricted = findAccount(network.restricted, normalized);

  if (
    !follower &&
    !following &&
    !pending &&
    !recentReq &&
    !unfollowed &&
    !blocked &&
    !restricted
  ) {
    return null;
  }

  const followsMe = Boolean(follower);
  const iFollowThem = Boolean(following);
  const isMutual = followsMe && iFollowThem;

  const followedMeAt = follower?.timestamp;
  const iFollowedAt = following?.timestamp;

  const timestamps = [followedMeAt, iFollowedAt].filter(
    (t): t is number => t !== undefined
  );
  const firstConnectedAt =
    timestamps.length > 0 ? Math.min(...timestamps) : undefined;

  const becameMutualAt =
    isMutual && followedMeAt && iFollowedAt
      ? Math.max(followedMeAt, iFollowedAt)
      : undefined;

  const categories: string[] = [];
  if (isMutual) categories.push("mutual");
  if (followsMe) categories.push("follower");
  if (iFollowThem) categories.push("following");
  if (iFollowThem && !followsMe) categories.push("don't follow me back");
  if (followsMe && !iFollowThem) categories.push("I don't follow back");
  if (pending) categories.push("pending");
  if (recentReq) categories.push("recent request");
  if (unfollowed) categories.push("recently unfollowed");
  if (blocked) categories.push("blocked");
  if (restricted) categories.push("restricted");

  const display =
    follower?.displayUsername ??
    following?.displayUsername ??
    pending?.displayUsername ??
    linkedinEntry?.displayUsername ??
    username;

  return {
    username: normalized,
    displayUsername: display,
    href:
      follower?.href ??
      following?.href ??
      linkedinEntry?.instagramHref ??
      instagramProfileUrl(normalized),
    followsMe,
    iFollowThem,
    isMutual,
    followedMeAt,
    iFollowedAt,
    firstConnectedAt,
    becameMutualAt,
    isPending: Boolean(pending),
    isRecentRequest: Boolean(recentReq),
    isRecentlyUnfollowed: Boolean(unfollowed),
    isBlocked: Boolean(blocked),
    isRestricted: Boolean(restricted),
    categories,
  };
}

export function getAccountsForLinkedInSource(
  network: NetworkStats,
  source: import("@/types/instagram").LinkedInSource
): InstagramAccount[] {
  switch (source) {
    case "mutuals":
      return network.mutuals.map((a) => ({ ...a, category: "mutual" }));
    case "followers":
      return network.followers.map((a) => ({ ...a, category: "follower" }));
    case "following":
      return network.following.map((a) => ({ ...a, category: "following" }));
    case "dontFollowMeBack":
      return network.dontFollowMeBack.map((a) => ({
        ...a,
        category: "don't follow me back",
      }));
    case "iDontFollowBack":
      return network.iDontFollowBack.map((a) => ({
        ...a,
        category: "I don't follow back",
      }));
    default: {
      const seen = new Map<string, InstagramAccount>();
      const addAll = (list: InstagramAccount[], category: string) => {
        for (const a of list) {
          const existing = seen.get(a.username);
          if (existing) {
            seen.set(a.username, {
              ...existing,
              category: `${existing.category}, ${category}`,
            });
          } else {
            seen.set(a.username, { ...a, category });
          }
        }
      };
      addAll(network.mutuals, "mutual");
      addAll(network.followers, "follower");
      addAll(network.following, "following");
      addAll(network.dontFollowMeBack, "don't follow me back");
      addAll(network.iDontFollowBack, "I don't follow back");
      addAll(network.pendingRequests, "pending");
      addAll(network.recentFollowRequests, "recent request");
      addAll(network.recentlyUnfollowed, "recently unfollowed");
      addAll(network.blocked, "blocked");
      addAll(network.restricted, "restricted");
      return Array.from(seen.values());
    }
  }
}

export function mergeAccountsToLinkedInEntries(
  accounts: InstagramAccount[],
  stored: LinkedInHelperEntry[] | null
): LinkedInHelperEntry[] {
  const storedMap = new Map((stored ?? []).map((e) => [e.username, e]));
  return accounts.map((a) => {
    const existing = storedMap.get(a.username);
    if (existing) {
      return {
        ...existing,
        displayUsername: a.displayUsername,
        instagramHref: a.href ?? instagramProfileUrl(a.username),
        category: a.category ?? existing.category,
      };
    }
    return {
      username: a.username,
      displayUsername: a.displayUsername,
      instagramHref: a.href ?? instagramProfileUrl(a.username),
      status: "not-reviewed" as const,
      notes: "",
      category: a.category,
    };
  });
}
