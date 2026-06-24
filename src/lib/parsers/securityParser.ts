import type { SecurityData } from "@/types/instagram";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function countItems(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  if (!isRecord(data)) return 0;

  const keys = [
    "account_history_login_history",
    "account_history_logout_history",
    "profile_activity",
    "profile_privacy_changes",
    "password_change_activity",
    "account_history_registration_info",
  ];

  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) return value.length;
  }

  let total = 0;
  for (const value of Object.values(data)) {
    if (Array.isArray(value)) total += value.length;
  }
  return total;
}

function findAndCount(files: Map<string, string>, fragment: string): number {
  const target = fragment.toLowerCase();
  for (const [path, content] of files) {
    const lower = path.toLowerCase().replace(/\\/g, "/");
    if (!lower.includes(target)) continue;
    try {
      return countItems(JSON.parse(content));
    } catch {
      continue;
    }
  }
  return 0;
}

export function parseSecurity(files: Map<string, string>): SecurityData | null {
  const loginCount = findAndCount(files, "login_activity.json");
  const logoutCount = findAndCount(files, "logout_activity.json");
  const profileActivityCount = findAndCount(files, "profile_activity.json");
  const privacyChangeCount = findAndCount(
    files,
    "profile_privacy_changes.json"
  );
  const passwordChangeCount = findAndCount(
    files,
    "password_change_activity.json"
  );

  const hasData =
    loginCount > 0 ||
    logoutCount > 0 ||
    profileActivityCount > 0 ||
    privacyChangeCount > 0 ||
    passwordChangeCount > 0;

  if (!hasData) return null;

  return {
    loginCount,
    logoutCount,
    profileActivityCount,
    privacyChangeCount,
    passwordChangeCount,
  };
}
