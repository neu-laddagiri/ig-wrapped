/** Reject JSON field labels and other junk mistaken for account names. */
const JUNK_KEYS = new Set([
  "owner",
  "hashtag",
  "name",
  "value",
  "title",
  "string_list_data",
  "media",
  "profile",
  "username",
  "href",
  "timestamp",
  "label",
  "entry",
  "entries",
  "data",
  "creation_timestamp",
  "uri",
  "text",
  "query",
  "search_query",
  "unknown",
  "null",
  "undefined",
  "true",
  "false",
  "you",
  "user",
  "account",
  "participant",
  "participants",
  "sender",
  "sender_name",
  "thread",
  "message",
  "messages",
  "inbox",
  "folder",
  "path",
]);

const PLACEHOLDER_NAMES = new Set([
  "instagram user",
  "instagram users",
  "unknown",
  "unknown user",
  "facebook user",
  "deleted user",
  "deactivated user",
]);

const GENERIC_SEARCH_LABELS = new Set([
  "search query",
  "search",
  "query",
  "searches",
  "recent searches",
  "search history",
]);

/** Instagram auto-generated usernames for deleted/deactivated accounts. */
export function isDegradedExportUsername(name: string): boolean {
  const n = name.trim().toLowerCase().replace(/^@/, "");
  if (/^instagramuser\d+$/.test(n)) return true;
  if (/^instagram_user\d+$/.test(n)) return true;
  if (/^instagram\s*user\s*\d+$/.test(n)) return true;
  if (/^user\d{5,}$/.test(n)) return true;
  return false;
}

export function isGenericSearchLabel(query: string): boolean {
  const n = query.trim().toLowerCase();
  return GENERIC_SEARCH_LABELS.has(n) || n.length < 2;
}

export const UNKNOWN_ACCOUNT_LABEL = "Unknown / deleted account";

export function isInstagramPlaceholderName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return (
    PLACEHOLDER_NAMES.has(n) ||
    n === "instagram user" ||
    isDegradedExportUsername(name) ||
    /^instagram\s*user\s+\d+/.test(n)
  );
}

/** Strip trailing Instagram numeric IDs from display labels. */
export function stripTrailingNumericId(name: string): string {
  const trimmed = name.trim();
  const spaced = trimmed.match(/^(.+?)\s+(\d{10,})$/);
  if (spaced) {
    const word = spaced[1].trim();
    if (word.length >= 2 && !/^\d+$/.test(word)) return word;
  }
  const glued = trimmed.match(/^([a-zA-Z][a-zA-Z0-9_.-]{0,40}?)(\d{10,})$/);
  if (glued) {
    const word = glued[1].replace(/[_.]+$/, "");
    if (word.length >= 2) return word;
  }
  return trimmed;
}

/** Clean a raw export label before display or matching. */
export function cleanRawDisplayName(name: string): string {
  const trimmed = name.trim().replace(/^@/, "");
  if (!trimmed) return "";
  if (isInstagramPlaceholderName(trimmed) || isDegradedExportUsername(trimmed)) {
    return UNKNOWN_ACCOUNT_LABEL;
  }
  const stripped = stripTrailingNumericId(trimmed);
  if (isInstagramPlaceholderName(stripped) || isDegradedExportUsername(stripped)) {
    return UNKNOWN_ACCOUNT_LABEL;
  }
  return stripped;
}

export function isValidAccountName(name: string): boolean {
  const raw = cleanRawDisplayName(name);
  if (!raw || raw === UNKNOWN_ACCOUNT_LABEL) return false;
  if (raw.length < 2 || raw.length > 80) return false;

  const n = raw.toLowerCase();
  if (JUNK_KEYS.has(n)) return false;
  if (PLACEHOLDER_NAMES.has(n)) return false;
  if (isDegradedExportUsername(raw)) return false;
  if (n.includes("http") || n.includes("instagram.com")) return false;
  if (/^[0-9]+$/.test(n)) return false;
  if (/^\{|\[/.test(raw)) return false;

  return true;
}

export function sanitizeAccountName(name: string): string | null {
  const cleaned = cleanRawDisplayName(name);
  if (!isValidAccountName(cleaned)) return null;
  return cleaned.toLowerCase().replace(/\s+/g, "");
}

/** Pick the best human-readable label from candidates. */
export function pickBestDisplayName(
  candidates: (string | undefined | null)[]
): string | null {
  for (const c of candidates) {
    if (!c?.trim()) continue;
    const t = cleanRawDisplayName(c);
    if (isValidAccountName(t)) return t;
  }
  for (const c of candidates) {
    if (!c?.trim()) continue;
    const t = cleanRawDisplayName(c);
    if (t && t !== UNKNOWN_ACCOUNT_LABEL && t.length >= 2) return t;
  }
  return null;
}

/** Display label for UI — never show long numeric ID suffixes. */
export function formatAccountDisplayName(name: string): string {
  const cleaned = cleanRawDisplayName(name);
  if (!cleaned) return UNKNOWN_ACCOUNT_LABEL;
  if (cleaned === UNKNOWN_ACCOUNT_LABEL) return UNKNOWN_ACCOUNT_LABEL;
  return cleaned;
}

/** Best-effort username handle for URLs/keys (without numeric junk). */
export function formatAccountUsername(raw: string): string {
  const display = cleanRawDisplayName(raw);
  if (!display || display === UNKNOWN_ACCOUNT_LABEL) {
    return raw.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, "");
  }
  if (/^[a-z0-9._]+$/.test(display.toLowerCase())) {
    return display.toLowerCase();
  }
  return display.toLowerCase().replace(/\s+/g, "");
}
