import type { InstagramAccount } from "@/types/instagram";
import {
  instagramProfileUrl,
  normalizeUsername,
  parseTimestamp,
} from "@/lib/formatters";
import {
  formatAccountDisplayName,
  formatAccountUsername,
  isValidAccountName,
} from "@/lib/accountNameFilter";

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

  const raw = value.trim().replace(/^@/, "");
  const displayName = formatAccountDisplayName(raw);
  const username = isValidAccountName(raw)
    ? normalizeUsername(formatAccountUsername(raw))
    : normalizeUsername(raw);

  const href =
    typeof entry.href === "string"
      ? entry.href
      : instagramProfileUrl(username);
  const timestamp = parseTimestamp(entry.timestamp);

  return {
    username,
    displayUsername: displayName === "Unknown / deleted account" ? raw : displayName,
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
    const raw = title.trim().replace(/^@/, "");
    const username = isValidAccountName(raw)
      ? normalizeUsername(formatAccountUsername(raw))
      : normalizeUsername(raw);
    return {
      username,
      displayUsername: formatAccountDisplayName(raw),
      href: instagramProfileUrl(username),
      category,
    };
  }

  if (typeof item.value === "string") {
    const raw = item.value.trim().replace(/^@/, "");
    const username = isValidAccountName(raw)
      ? normalizeUsername(formatAccountUsername(raw))
      : normalizeUsername(raw);
    return {
      username,
      displayUsername: formatAccountDisplayName(raw),
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
): { content: string; path: string } | null {
  for (const pattern of patterns) {
    const normalized = pattern.toLowerCase();
    for (const [path, content] of files) {
      const lower = path.toLowerCase().replace(/\\/g, "/");
      if (lower.endsWith(normalized) || lower.includes(normalized)) {
        return { content, path };
      }
    }
  }
  return null;
}

function findNetworkListFile(
  files: Map<string, string>,
  fragments: string[]
): { content: string; path: string } | null {
  for (const [path, content] of files) {
    const lower = path.toLowerCase().replace(/\\/g, "/");
    if (!fragments.some((f) => lower.includes(f.toLowerCase()))) continue;
    if (!lower.endsWith(".json")) continue;
    return { content, path };
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

  const blockedFile = findNetworkListFile(files, [
    "blocked_profiles",
    "blocked_users",
    "relationships_blocked",
    "blocked_accounts",
  ]);
  const restrictedFile = findNetworkListFile(files, [
    "restricted_profiles",
    "restricted_accounts",
    "relationships_restricted",
  ]);

  if (!followersContent && !followingContent) {
    return { network: null, errors };
  }

  const followers = followersContent
    ? parseAccountList(safeParseJson(followersContent.content), "follower")
    : [];
  const following = followingContent
    ? parseAccountList(safeParseJson(followingContent.content), "following")
    : [];

  if (followersContent && followers.length === 0) {
    errors.push("Could not parse followers file — format may differ.");
  }
  if (followingContent && following.length === 0) {
    errors.push("Could not parse following file — format may differ.");
  }

  const pendingRequests = pendingContent
    ? parseAccountList(safeParseJson(pendingContent.content), "pending")
    : [];
  const recentFollowRequests = recentRequestsContent
    ? parseAccountList(safeParseJson(recentRequestsContent.content), "recent_request")
    : [];
  const recentlyUnfollowed = unfollowedContent
    ? parseAccountList(safeParseJson(unfollowedContent.content), "unfollowed")
    : [];
  const blocked = blockedFile
    ? parseAccountList(safeParseJson(blockedFile.content), "blocked")
    : [];
  const restricted = restrictedFile
    ? parseAccountList(safeParseJson(restrictedFile.content), "restricted")
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
      blockedMeta: {
        includedInExport: Boolean(blockedFile),
        sourcePath: blockedFile?.path,
      },
      restrictedMeta: {
        includedInExport: Boolean(restrictedFile),
        sourcePath: restrictedFile?.path,
      },
    },
    errors,
  };
}
