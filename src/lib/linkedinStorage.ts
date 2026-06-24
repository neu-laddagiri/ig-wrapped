import type { LinkedInHelperEntry } from "@/types/instagram";

const STORAGE_PREFIX = "ig-wrapped-linkedin";

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
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveLinkedInProgress(
  fingerprint: string,
  entries: LinkedInHelperEntry[]
): void {
  if (typeof window === "undefined" || !fingerprint) return;
  try {
    localStorage.setItem(
      getLinkedInStorageKey(fingerprint),
      JSON.stringify(entries)
    );
  } catch {
    // quota exceeded or private mode — ignore
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
