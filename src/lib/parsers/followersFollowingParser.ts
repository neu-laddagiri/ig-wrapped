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

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

const NON_PROFILE_PATHS = new Set(["p", "reel", "reels", "stories", "explore", "accounts"]);

/** Newer exports sometimes only carry the profile link (…/_u/username). */
function usernameFromHref(href: unknown): string | undefined {
  if (typeof href !== "string") return undefined;
  const match = href.match(
    /instagram\.com\/(?:_u\/)?([A-Za-z0-9._]+)\/?(?:[?#].*)?$/i
  );
  if (!match || NON_PROFILE_PATHS.has(match[1].toLowerCase())) return undefined;
  return match[1];
}

/**
 * Relationship files hold real handles, so keep them exactly as exported.
 * (Trailing-ID cleanup is only for DM folder names — applying it here would
 * merge distinct handles like "rahul_9876543210" and "rahul".)
 */
function accountFromHandle(
  handle: string,
  source: JsonRecord,
  category?: string
): InstagramAccount | null {
  const raw = handle.trim().replace(/^@/, "");
  if (!raw) return null;
  const username = normalizeUsername(raw);
  return {
    username,
    displayUsername: raw,
    href: nonEmptyString(source.href) ?? instagramProfileUrl(username),
    timestamp: parseTimestamp(source.timestamp),
    category,
  };
}

function accountFromStringListEntry(
  entry: JsonRecord,
  fallbackUsername?: string,
  category?: string
): InstagramAccount | null {
  const handle =
    nonEmptyString(entry.value) ??
    nonEmptyString(entry.title) ??
    nonEmptyString(fallbackUsername) ??
    usernameFromHref(entry.href);
  return handle ? accountFromHandle(handle, entry, category) : null;
}

function accountFromItem(
  item: unknown,
  category?: string
): InstagramAccount | null {
  if (!isRecord(item)) return null;

  const title = nonEmptyString(item.title);
  const stringList = getStringListData(item);

  if (stringList.length > 0) {
    const fromList = accountFromStringListEntry(
      stringList[0],
      title,
      category
    );
    if (fromList) return fromList;
  }

  const handle =
    title ?? nonEmptyString(item.value) ?? usernameFromHref(item.href);
  return handle ? accountFromHandle(handle, item, category) : null;
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

/** Big accounts get followers_1.json, followers_2.json, … — every part counts. */
function findFollowerFiles(
  files: Map<string, string>
): { content: string; path: string }[] {
  const parts: { content: string; path: string; part: number }[] = [];
  for (const [path, content] of files) {
    const match = path
      .toLowerCase()
      .replace(/\\/g, "/")
      .match(/(?:^|\/)followers_(\d+)\.json$/);
    if (match) parts.push({ content, path, part: Number(match[1]) });
  }
  if (parts.length > 0) return parts.sort((a, b) => a.part - b.part);
  const legacy = findFileContent(files, ["followers.json"]);
  return legacy ? [legacy] : [];
}

function safeParseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/** True when a parsed file holds entries (so zero accounts means an unknown format). */
function hasListEntries(data: unknown): boolean {
  if (Array.isArray(data)) return data.length > 0;
  if (!isRecord(data)) return false;
  return Object.values(data).some((v) => Array.isArray(v) && v.length > 0);
}

function parseAccountFiles(
  parts: { content: string }[],
  category: string
): { accounts: InstagramAccount[]; unreadable: boolean } {
  const accounts: InstagramAccount[] = [];
  const seen = new Set<string>();
  let unreadable = false;
  for (const { content } of parts) {
    const data = safeParseJson(content);
    const parsed = parseAccountList(data, category);
    if (data === null || (parsed.length === 0 && hasListEntries(data))) {
      unreadable = true;
    }
    for (const account of parsed) {
      if (seen.has(account.username)) continue;
      seen.add(account.username);
      accounts.push(account);
    }
  }
  return { accounts, unreadable };
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

  const followerFiles = findFollowerFiles(files);

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

  if (followerFiles.length === 0 && !followingContent) {
    return { network: null, errors };
  }

  const followerResult = parseAccountFiles(followerFiles, "follower");
  const followingResult = followingContent
    ? parseAccountFiles([followingContent], "following")
    : { accounts: [], unreadable: false };
  const followers = followerResult.accounts;
  const following = followingResult.accounts;

  if (followerResult.unreadable) {
    errors.push("Could not parse followers file — format may differ.");
  }
  if (followingResult.unreadable) {
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
