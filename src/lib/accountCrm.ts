export type AccountCrmTag =
  | "close-friend"
  | "classmate"
  | "club"
  | "trip"
  | "family"
  | "networking"
  | "random"
  | "avoid"
  | "follow-up"
  | "custom";

export type AccountCrmStatus =
  | "not-reviewed"
  | "reviewed"
  | "should-dm"
  | "should-unfollow"
  | "keep"
  | "ignore"
  | "reached-out";

export interface AccountCrmEntry {
  username: string;
  note?: string;
  tags: AccountCrmTag[];
  customTag?: string;
  status: AccountCrmStatus;
  updatedAt: string;
}

export interface CleanupPrefs {
  reviewed: string[];
  hidden: string[];
}

const CRM_PREFIX = "ig-wrapped-crm";
const CLEANUP_PREFIX = "ig-wrapped-cleanup";

function crmKey(fingerprint: string): string {
  return `${CRM_PREFIX}:${fingerprint}`;
}

function cleanupKey(fingerprint: string): string {
  return `${CLEANUP_PREFIX}:${fingerprint}`;
}

export function loadAccountCrm(fingerprint: string): Record<string, AccountCrmEntry> {
  if (typeof window === "undefined" || !fingerprint) return {};
  try {
    const raw = localStorage.getItem(crmKey(fingerprint));
    return raw ? (JSON.parse(raw) as Record<string, AccountCrmEntry>) : {};
  } catch {
    return {};
  }
}

export function saveAccountCrmEntry(
  fingerprint: string,
  entry: AccountCrmEntry
): void {
  if (typeof window === "undefined" || !fingerprint) return;
  const all = loadAccountCrm(fingerprint);
  all[entry.username] = entry;
  try {
    localStorage.setItem(crmKey(fingerprint), JSON.stringify(all));
  } catch {
    // ignore
  }
}

export function loadCleanupPrefs(fingerprint: string): CleanupPrefs {
  if (typeof window === "undefined" || !fingerprint) {
    return { reviewed: [], hidden: [] };
  }
  try {
    const raw = localStorage.getItem(cleanupKey(fingerprint));
    if (!raw) return { reviewed: [], hidden: [] };
    const parsed = JSON.parse(raw) as CleanupPrefs;
    return {
      reviewed: parsed.reviewed ?? [],
      hidden: parsed.hidden ?? [],
    };
  } catch {
    return { reviewed: [], hidden: [] };
  }
}

export function saveCleanupPrefs(
  fingerprint: string,
  prefs: CleanupPrefs
): void {
  if (typeof window === "undefined" || !fingerprint) return;
  try {
    localStorage.setItem(cleanupKey(fingerprint), JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export const CRM_TAG_LABELS: Record<AccountCrmTag, string> = {
  "close-friend": "Close friend",
  classmate: "Classmate",
  club: "Club",
  trip: "Greece trip",
  family: "Family",
  networking: "Networking",
  random: "Random",
  avoid: "Avoid",
  "follow-up": "Follow up",
  custom: "Custom",
};

export const CRM_STATUS_LABELS: Record<AccountCrmStatus, string> = {
  "not-reviewed": "Not reviewed",
  reviewed: "Reviewed",
  "should-dm": "Should DM",
  "should-unfollow": "Should unfollow",
  keep: "Keep",
  ignore: "Ignore",
  "reached-out": "Reached out",
};
