import type { InstagramAccount } from "@/types/instagram";
import {
  instagramProfileUrl,
  normalizeUsername,
  parseTimestamp,
} from "@/lib/formatters";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStringListData(item: unknown): JsonRecord[] {
  if (!isRecord(item)) return [];
  const data = item.string_list_data;
  return Array.isArray(data)
    ? data.filter(isRecord)
    : [];
}

function accountFromStringListEntry(
  entry: JsonRecord,
  fallbackUsername?: string,
  category?: string
): InstagramAccount | null {
  const value =
    typeof entry.value === "string"
      ? entry.value
      : typeof entry.title === "string"
        ? entry.title
        : fallbackUsername;

  if (!value?.trim()) return null;

  const username = normalizeUsername(value);
  const href =
    typeof entry.href === "string"
      ? entry.href
      : instagramProfileUrl(username);
  const timestamp = parseTimestamp(entry.timestamp);

  return {
    username,
    displayUsername: value.trim().replace(/^@/, ""),
    href,
    timestamp,
    category,
  };
}

function accountFromItem(
  item: unknown,
  category?: string
): InstagramAccount | null {
  if (!isRecord(item)) return null;

  const title =
    typeof item.title === "string" ? item.title : undefined;
  const stringList = getStringListData(item);

  if (stringList.length > 0) {
    const fromList = accountFromStringListEntry(
      stringList[0],
      title,
      category
    );
    if (fromList) return fromList;
  }

  if (title) {
    const username = normalizeUsername(title);
    return {
      username,
      displayUsername: title.trim().replace(/^@/, ""),
      href: instagramProfileUrl(username),
      category,
    };
  }

  if (typeof item.value === "string") {
    const username = normalizeUsername(item.value);
    return {
      username,
      displayUsername: item.value.trim().replace(/^@/, ""),
      href:
        typeof item.href === "string"
          ? item.href
          : instagramProfileUrl(username),
      timestamp: parseTimestamp(item.timestamp),
      category,
    };
  }

  return null;
}

function parseAccountList(data: unknown, category?: string): InstagramAccount[] {
  const accounts: InstagramAccount[] = [];
  const seen = new Set<string>();

  const add = (item: unknown) => {
    const account = accountFromItem(item, category);
    if (account && !seen.has(account.username)) {
      seen.add(account.username);
      accounts.push(account);
    }
  };

  if (Array.isArray(data)) {
    data.forEach(add);
    return accounts;
  }

  if (!isRecord(data)) return accounts;

  const arrayKeys = [
    "relationships_following",
    "relationships_followers",
    "relationships_blocked",
    "relationships_restricted",
    "relationships_pending_follow_requests",
    "relationships_recent_follow_requests",
    "relationships_recently_unfollowed",
    "string_list_data",
  ];

  for (const key of arrayKeys) {
    const arr = data[key];
    if (Array.isArray(arr)) arr.forEach(add);
  }

  if (accounts.length === 0) {
    Object.values(data).forEach((value) => {
      if (Array.isArray(value)) value.forEach(add);
    });
  }

  return accounts;
}

function findFileContent(
  files: Map<string, string>,
  patterns: string[]
): string | null {
  for (const pattern of patterns) {
    const normalized = pattern.toLowerCase();
    for (const [path, content] of files) {
      const lower = path.toLowerCase().replace(/\\/g, "/");
      if (lower.endsWith(normalized) || lower.includes(normalized)) {
        return content;
      }
    }
  }
  return null;
}

function safeParseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function computeNetworkSets(
  followers: InstagramAccount[],
  following: InstagramAccount[]
) {
  const followerSet = new Set(followers.map((f) => f.username));
  const followingSet = new Set(following.map((f) => f.username));

  const mutuals = followers.filter((f) => followingSet.has(f.username));
  const dontFollowMeBack = following.filter(
    (f) => !followerSet.has(f.username)
  );
  const iDontFollowBack = followers.filter(
    (f) => !followingSet.has(f.username)
  );

  const followBackRatio =
    following.length > 0 ? mutuals.length / following.length : 0;

  return {
    mutuals,
    dontFollowMeBack,
    iDontFollowBack,
    followBackRatio,
  };
}

export function parseFollowersFollowing(
  files: Map<string, string>
): {
  network: import("@/types/instagram").NetworkStats | null;
  errors: string[];
} {
  const errors: string[] = [];

  const followersContent = findFileContent(files, [
    "connections/followers_and_following/followers_1.json",
    "followers_and_following/followers_1.json",
    "followers_1.json",
    "followers.json",
  ]);

  const followingContent = findFileContent(files, [
    "connections/followers_and_following/following.json",
    "followers_and_following/following.json",
    "following.json",
  ]);

  const pendingContent = findFileContent(files, [
    "pending_follow_requests.json",
  ]);

  const recentRequestsContent = findFileContent(files, [
    "recent_follow_requests.json",
  ]);

  const unfollowedContent = findFileContent(files, [
    "recently_unfollowed_profiles.json",
  ]);

  const blockedContent = findFileContent(files, ["blocked_profiles.json"]);
  const restrictedContent = findFileContent(files, [
    "restricted_profiles.json",
  ]);

  if (!followersContent && !followingContent) {
    return { network: null, errors };
  }

  const followers = followersContent
    ? parseAccountList(safeParseJson(followersContent), "follower")
    : [];
  const following = followingContent
    ? parseAccountList(safeParseJson(followingContent), "following")
    : [];

  if (followersContent && followers.length === 0) {
    errors.push("Could not parse followers file — format may differ.");
  }
  if (followingContent && following.length === 0) {
    errors.push("Could not parse following file — format may differ.");
  }

  const pendingRequests = pendingContent
    ? parseAccountList(safeParseJson(pendingContent), "pending")
    : [];
  const recentFollowRequests = recentRequestsContent
    ? parseAccountList(safeParseJson(recentRequestsContent), "recent_request")
    : [];
  const recentlyUnfollowed = unfollowedContent
    ? parseAccountList(safeParseJson(unfollowedContent), "unfollowed")
    : [];
  const blocked = blockedContent
    ? parseAccountList(safeParseJson(blockedContent), "blocked")
    : [];
  const restricted = restrictedContent
    ? parseAccountList(safeParseJson(restrictedContent), "restricted")
    : [];

  const sets = computeNetworkSets(followers, following);

  return {
    network: {
      totalFollowers: followers.length,
      totalFollowing: following.length,
      followers,
      following,
      mutuals: sets.mutuals,
      dontFollowMeBack: sets.dontFollowMeBack,
      iDontFollowBack: sets.iDontFollowBack,
      followBackRatio: sets.followBackRatio,
      pendingRequests,
      recentFollowRequests,
      recentlyUnfollowed,
      blocked,
      restricted,
    },
    errors,
  };
}
