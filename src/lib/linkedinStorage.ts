import type { LinkedInHelperEntry, LinkedInStatus } from "@/types/instagram";

const STORAGE_PREFIX = "ig-wrapped-linkedin";

const STATUSES = new Set<LinkedInStatus>([
  "not-reviewed",
  "found",
  "request-sent",
  "connected",
  "skip",
  "not-found",
]);

function normalizeEntry(raw: unknown): LinkedInHelperEntry | null {
  if (typeof raw !== "object" || raw === null) return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.username !== "string" || !e.username.trim()) return null;
  return {
    username: e.username,
    displayUsername:
      typeof e.displayUsername === "string" ? e.displayUsername : e.username,
    instagramHref: typeof e.instagramHref === "string" ? e.instagramHref : undefined,
    status: STATUSES.has(e.status as LinkedInStatus)
      ? (e.status as LinkedInStatus)
      : "not-reviewed",
    notes: typeof e.notes === "string" ? e.notes : "",
    category: typeof e.category === "string" ? e.category : undefined,
  };
}

/** Drops malformed rows and fills fields older saves may lack. */
export function normalizeLinkedInEntries(raw: unknown): LinkedInHelperEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeEntry)
    .filter((e): e is LinkedInHelperEntry => e !== null);
}

export function getLinkedInStorageKey(fingerprint: string): string {
  return `${STORAGE_PREFIX}:${fingerprint}`;
}

export function loadLinkedInProgress(
  fingerprint: string
): LinkedInHelperEntry[] | null {
  if (typeof window === "undefined" || !fingerprint) return null;
  try {
    const raw = localStorage.getItem(getLinkedInStorageKey(fingerprint));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeLinkedInEntries(parsed) : null;
  } catch {
    return null;
  }
}

/** Returns false when the browser refused the write (quota or private mode). */
export function saveLinkedInProgress(
  fingerprint: string,
  entries: LinkedInHelperEntry[]
): boolean {
  if (typeof window === "undefined" || !fingerprint) return false;
  try {
    localStorage.setItem(
      getLinkedInStorageKey(fingerprint),
      JSON.stringify(entries)
    );
    return true;
  } catch {
    return false;
  }
}

export function clearLinkedInProgress(fingerprint: string): void {
  if (typeof window === "undefined" || !fingerprint) return;
  try {
    localStorage.removeItem(getLinkedInStorageKey(fingerprint));
  } catch {
    // ignore
  }
}

export async function computeFileFingerprint(file: File): Promise<string> {
  const base = `${file.name}:${file.size}:${file.lastModified}`;
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const encoded = new TextEncoder().encode(base);
      const hash = await crypto.subtle.digest("SHA-256", encoded);
      return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 32);
    } catch {
      // fall through
    }
  }
  return base.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

export function fingerprintFromMeta(
  exportName: string,
  storedFingerprint?: string
): string {
  return storedFingerprint ?? exportName.replace(/[^a-zA-Z0-9_-]/g, "_");
}
