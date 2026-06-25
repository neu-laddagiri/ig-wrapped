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

export function isInstagramPlaceholderName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return PLACEHOLDER_NAMES.has(n) || n === "instagram user";
}

export function isValidAccountName(name: string): boolean {
  const raw = name.trim();
  if (!raw || raw.length < 2 || raw.length > 80) return false;

  const n = raw.replace(/^@/, "").toLowerCase();
  if (JUNK_KEYS.has(n)) return false;
  if (PLACEHOLDER_NAMES.has(n)) return false;
  if (n.includes("http") || n.includes("instagram.com")) return false;
  if (/^[0-9]+$/.test(n)) return false;
  if (/^\{|\[/.test(raw)) return false;

  return true;
}

export function sanitizeAccountName(name: string): string | null {
  const cleaned = name.trim().replace(/^@/, "");
  if (!isValidAccountName(cleaned)) return null;
  return cleaned.toLowerCase();
}

/** Pick the best human-readable label from candidates. */
export function pickBestDisplayName(
  candidates: (string | undefined | null)[]
): string | null {
  for (const c of candidates) {
    if (!c?.trim()) continue;
    const t = c.trim();
    if (isValidAccountName(t)) return t;
  }
  for (const c of candidates) {
    if (!c?.trim()) continue;
    const t = c.trim();
    if (!isInstagramPlaceholderName(t) && t.length >= 2) return t;
  }
  return null;
}

/** Display label for UI — maps generic export placeholders to a clearer name. */
export function formatAccountDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Unknown / deleted account";
  if (isInstagramPlaceholderName(trimmed)) return "Unknown / deleted account";
  return trimmed;
}
