import {
  formatAccountDisplayName,
  isInstagramPlaceholderName,
  UNKNOWN_ACCOUNT_LABEL,
} from "@/lib/accountNameFilter";

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

export function usernameFromFolderPath(path?: string): string | null {
  const segment = rawFolderSegment(path);
  if (!segment) return null;
  const user = normalizeUsername(segment);
  return isLikelyInstagramUsername(user) ? user : null;
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
    if (user.startsWith("thread:") || user.startsWith("dm:") || user.startsWith("unknown:")) {
      return user;
    }
  }

  const fromUrl = usernameFromProfileUrl(input.profileUrl);
  if (fromUrl) return fromUrl;

  const fromFolder = usernameFromFolderPath(input.folderPath);
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
  const isSynthetic =
    user.startsWith("thread:") ||
    user.startsWith("dm:") ||
    user.startsWith("unknown:") ||
    user.startsWith("pid:");

  if (isSynthetic) {
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
  if (
    user.startsWith("thread:") ||
    user.startsWith("dm:") ||
    user.startsWith("unknown:") ||
    user.startsWith("pid:")
  ) {
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
  return (
    k.startsWith("thread:") ||
    k.startsWith("dm:") ||
    k.startsWith("unknown:") ||
    k.startsWith("pid:")
  );
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
