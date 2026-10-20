import {
  formatAccountDisplayName,
  isInstagramPlaceholderName,
  UNKNOWN_ACCOUNT_LABEL,
} from "@/lib/accountNameFilter";
import type { InstagramAccount, NetworkStats } from "@/types/instagram";

/** Lowercase Instagram handle — preserves `.`, `_`, and digits. */
export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

export interface AccountIdentityInput {
  username?: string;
  profileUrl?: string;
  folderPath?: string;
  threadId?: string;
  participantId?: string;
  displayName?: string;
  /** Lets the folder slug resolve to a username, but only one that exists in the network export. */
  networkIndex?: NetworkUsernameIndex | null;
}

const SYNTHETIC_PREFIXES = ["thread:", "dm:", "unknown:", "pid:", "group:"];

/** Every username in the followers/following export, for exact joins. */
export interface NetworkUsernameIndex {
  exact: Set<string>;
  /** Username with `.` and `_` removed → username; null when two handles collide. */
  loose: Map<string, string | null>;
  accounts: Map<string, InstagramAccount>;
}

const networkIndexCache = new WeakMap<NetworkStats, NetworkUsernameIndex>();

function looseHandleKey(value: string): string {
  return value.replace(/[._]/g, "");
}

export function buildNetworkUsernameIndex(
  network: NetworkStats | null | undefined
): NetworkUsernameIndex | null {
  if (!network) return null;
  const cached = networkIndexCache.get(network);
  if (cached) return cached;

  const exact = new Set<string>();
  const loose = new Map<string, string | null>();
  const accounts = new Map<string, InstagramAccount>();
  const lists = [
    network.followers,
    network.following,
    network.mutuals,
    network.dontFollowMeBack,
    network.iDontFollowBack,
    network.pendingRequests,
    network.recentFollowRequests,
    network.recentlyUnfollowed,
    network.blocked,
    network.restricted,
  ];
  for (const list of lists) {
    for (const acc of list ?? []) {
      const user = normalizeUsername(acc.username);
      if (!user || exact.has(user)) continue;
      exact.add(user);
      accounts.set(user, acc);
      const key = looseHandleKey(user);
      const existing = loose.get(key);
      if (existing === undefined) loose.set(key, user);
      else if (existing !== user) loose.set(key, null);
    }
  }

  const index = { exact, loose, accounts };
  networkIndexCache.set(network, index);
  return index;
}

/** Exact network username, or (when `allowLoose`) the only handle equal to it once `.`/`_` are ignored. */
export function matchNetworkUsername(
  index: NetworkUsernameIndex | null | undefined,
  candidate: string,
  allowLoose = false
): string | null {
  if (!index || !candidate?.trim()) return null;
  const user = normalizeUsername(candidate);
  if (index.exact.has(user)) return user;
  if (!allowLoose) return null;
  return index.loose.get(looseHandleKey(user)) ?? null;
}

/**
 * A DM participant/sender name used as a username. Plain words ("Alex", "maria")
 * are display names unless the network export has that handle; handle-shaped
 * names (dot, underscore or digit) are what Instagram shows for accounts with no
 * full name, so they are kept even when the account is not in the network.
 */
export function resolveUsernameCandidate(
  value: string,
  index?: NetworkUsernameIndex | null
): string | null {
  const user = normalizeUsername(value);
  if (!isLikelyInstagramUsername(user)) return null;
  if (index?.exact.has(user)) return user;
  return /[._\d]/.test(user) && /[a-z]/.test(user) ? user : null;
}

export interface AccountIdentity {
  canonicalKey: string;
  username: string;
  displayName: string;
  secondaryLabel: string;
  isUnknownDeleted: boolean;
  sourcePath?: string;
  threadId?: string;
}

const USERNAME_RE = /^[a-z0-9._]{1,30}$/;

export function isLikelyInstagramUsername(value: string): boolean {
  const n = normalizeUsername(value);
  if (!n || n.length > 30) return false;
  if (isInstagramPlaceholderName(n)) return false;
  return USERNAME_RE.test(n);
}

export function usernameFromProfileUrl(url?: string): string | null {
  if (!url?.trim()) return null;
  const match = url.match(
    /instagram\.com\/(?!p\/|reel\/|tv\/|stories\/)([a-zA-Z0-9._]+)/i
  );
  if (!match?.[1]) return null;
  const user = normalizeUsername(match[1]);
  if (!isLikelyInstagramUsername(user)) return null;
  return user;
}

/** Raw inbox folder segment — keeps underscores and periods. */
export function rawFolderSegment(path?: string): string | null {
  if (!path?.trim()) return null;
  const parts = path.replace(/\\/g, "/").split("/");
  const inboxIdx = parts.findIndex(
    (p) => p === "inbox" || p === "message_requests"
  );
  if (inboxIdx < 0 || !parts[inboxIdx + 1]) return null;
  const segment = parts[inboxIdx + 1].trim();
  if (!segment || isInstagramPlaceholderName(segment)) return null;
  return segment;
}

/** Inbox folder name without Instagram's `_<thread id>` suffix (`janedoe_1784…` → `janedoe`). */
export function folderSlugFromPath(path?: string): string | null {
  const segment = rawFolderSegment(path);
  if (!segment) return null;
  const slug = normalizeUsername(segment.replace(/_\d{6,}$/, ""));
  return slug || null;
}

/** Folder slug as a username — only when it matches an account in the network export. */
export function usernameFromFolderPath(
  path?: string,
  index?: NetworkUsernameIndex | null
): string | null {
  const slug = folderSlugFromPath(path);
  if (!slug || !index) return null;
  return matchNetworkUsername(index, slug, true);
}

function stablePathKey(path: string): string {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  return `unknown:${normalized}`;
}

/**
 * Canonical identity key — never uses display name or fuzzy matching.
 * Priority: username → profile URL → folder username → participant id → thread id → path fallback.
 */
export function getCanonicalAccountKey(input: AccountIdentityInput): string {
  if (input.username?.trim()) {
    const user = normalizeUsername(input.username);
    if (isLikelyInstagramUsername(user)) return user;
    if (isSyntheticCanonicalKey(user)) return user;
  }

  const fromUrl = usernameFromProfileUrl(input.profileUrl);
  if (fromUrl) return fromUrl;

  const fromFolder = usernameFromFolderPath(input.folderPath, input.networkIndex);
  if (fromFolder) return fromFolder;

  if (input.participantId?.trim()) {
    return `pid:${input.participantId.trim().toLowerCase()}`;
  }

  if (input.threadId?.trim()) {
    return `thread:${input.threadId.trim()}`;
  }

  if (input.folderPath?.trim()) {
    return stablePathKey(input.folderPath);
  }

  return `unknown:orphan`;
}

export function getDisplayLabel(account: {
  displayName?: string;
  username: string;
}): string {
  const user = normalizeUsername(account.username);

  if (isSyntheticCanonicalKey(user)) {
    const display = account.displayName?.trim();
    if (display && display !== UNKNOWN_ACCOUNT_LABEL) {
      return formatAccountDisplayName(display);
    }
    return UNKNOWN_ACCOUNT_LABEL;
  }

  const display = account.displayName?.trim();
  if (
    display &&
    display !== UNKNOWN_ACCOUNT_LABEL &&
    normalizeUsername(display) !== user
  ) {
    return formatAccountDisplayName(display);
  }

  if (isLikelyInstagramUsername(user)) {
    return user;
  }

  return formatAccountDisplayName(display || user) || UNKNOWN_ACCOUNT_LABEL;
}

export function getSecondaryLabel(account: { username: string }): string {
  const user = normalizeUsername(account.username);
  if (isSyntheticCanonicalKey(user)) {
    if (user.startsWith("group:")) return "group chats";
    if (user.startsWith("thread:")) return user.replace("thread:", "thread ");
    if (user.startsWith("unknown:")) {
      const path = user.slice("unknown:".length);
      return path.length > 48 ? `…${path.slice(-44)}` : path;
    }
    return user;
  }
  return `@${user}`;
}

export function isSyntheticCanonicalKey(key: string): boolean {
  const k = key.toLowerCase();
  return SYNTHETIC_PREFIXES.some((prefix) => k.startsWith(prefix));
}

/** Dedupe records by canonical key only — never merge by display name. */
export function mergeAccountRecords<T extends AccountIdentityInput & { displayName?: string }>(
  records: T[],
  resolve: (record: T) => AccountIdentity
): AccountIdentity[] {
  const map = new Map<string, AccountIdentity>();
  for (const record of records) {
    const identity = resolve(record);
    if (!map.has(identity.canonicalKey)) {
      map.set(identity.canonicalKey, identity);
    }
  }
  return [...map.values()];
}

export interface IdentityValidationReport {
  totalRecords: number;
  uniqueCanonicalKeys: number;
  duplicateDisplayNamesPreserved: number;
  unknownFallbackAccounts: number;
  warnings: string[];
}

export function validateIdentityIndex(
  identities: AccountIdentity[]
): IdentityValidationReport {
  const warnings: string[] = [];
  const byKey = new Map<string, AccountIdentity>();
  const displayToKeys = new Map<string, Set<string>>();

  for (const id of identities) {
    const existing = byKey.get(id.canonicalKey);
    if (existing && existing.username !== id.username) {
      warnings.push(
        `Duplicate canonical key "${id.canonicalKey}" with different usernames: ${existing.username} vs ${id.username}`
      );
    }
    byKey.set(id.canonicalKey, id);

    const display = id.displayName.toLowerCase();
    if (!displayToKeys.has(display)) displayToKeys.set(display, new Set());
    displayToKeys.get(display)!.add(id.canonicalKey);
  }

  let duplicateDisplayNamesPreserved = 0;
  for (const [, keys] of displayToKeys) {
    if (keys.size > 1) duplicateDisplayNamesPreserved += keys.size;
  }

  const unknownFallbackAccounts = identities.filter((id) =>
    isSyntheticCanonicalKey(id.canonicalKey)
  ).length;

  if (process.env.NODE_ENV === "development") {
    console.info("[IG Wrapped identity]", {
      totalRecords: identities.length,
      uniqueCanonicalKeys: byKey.size,
      duplicateDisplayNamesPreserved,
      unknownFallbackAccounts,
      warningCount: warnings.length,
    });
    for (const w of warnings.slice(0, 10)) {
      console.warn("[IG Wrapped identity]", w);
    }
  }

  return {
    totalRecords: identities.length,
    uniqueCanonicalKeys: byKey.size,
    duplicateDisplayNamesPreserved,
    unknownFallbackAccounts,
    warnings,
  };
}

/** Exact username equality only — no fuzzy / display-name matching. */
export function usernamesMatch(a: string, b: string): boolean {
  return normalizeUsername(a) === normalizeUsername(b);
}
