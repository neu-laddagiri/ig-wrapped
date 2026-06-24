import { formatTimestamp, parseTimestamp } from "@/lib/formatters";
import { analyzeSuspiciousLogins } from "@/lib/securityAnalysis";
import type {
  SecurityData,
  SecurityEvent,
  SecurityEventType,
} from "@/types/instagram";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableId(parts: (string | number | undefined)[]): string {
  return parts.filter(Boolean).join("|").slice(0, 200);
}

const FILE_RULES: { fragment: string; type: SecurityEventType; label: string }[] =
  [
    { fragment: "login_activity.json", type: "login", label: "Login" },
    { fragment: "logout_activity.json", type: "logout", label: "Logout" },
    {
      fragment: "profile_activity.json",
      type: "profile_activity",
      label: "Profile activity",
    },
    {
      fragment: "profile_privacy_changes.json",
      type: "privacy_change",
      label: "Privacy change",
    },
    {
      fragment: "password_change_activity.json",
      type: "password_change",
      label: "Password change",
    },
    { fragment: "signup_details.json", type: "signup", label: "Signup" },
  ];

const LOCATION_KEYS = [
  "location",
  "city",
  "region",
  "country",
  "ip_address",
  "ip",
];
const DEVICE_KEYS = [
  "device",
  "user_agent",
  "browser",
  "device_name",
  "platform",
];

function pickString(obj: JsonRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  return undefined;
}

function extractFromStringMap(
  map: unknown
): { device?: string; location?: string; ip?: string; label?: string } {
  if (!isRecord(map)) return {};
  const result: {
    device?: string;
    location?: string;
    ip?: string;
    label?: string;
  } = {};

  for (const [key, entry] of Object.entries(map)) {
    if (!isRecord(entry)) continue;
    const value =
      typeof entry.value === "string" ? entry.value.trim() : undefined;
    if (!value) continue;
    const lower = key.toLowerCase();
    if (DEVICE_KEYS.some((k) => lower.includes(k))) result.device = value;
    else if (lower.includes("ip")) result.ip = value;
    else if (LOCATION_KEYS.some((k) => lower.includes(k))) {
      result.location = result.location ? `${result.location}, ${value}` : value;
    } else if (lower.includes("user") || lower.includes("name")) {
      result.label = value;
    }
  }
  return result;
}

function buildLocation(parts: (string | undefined)[]): string | undefined {
  const joined = parts.filter(Boolean).join(", ");
  return joined || undefined;
}

function eventFromRecord(
  item: JsonRecord,
  type: SecurityEventType,
  defaultLabel: string,
  sourcePath: string,
  index: number
): SecurityEvent | null {
  const title = typeof item.title === "string" ? item.title.trim() : undefined;
  const label =
    title ||
    pickString(item, ["label", "name", "value", "action", "description"]) ||
    defaultLabel;

  let timestamp = parseTimestamp(
    item.timestamp ?? item.timestamp_ms ?? item.creation_timestamp
  );
  let device: string | undefined;
  let location: string | undefined;
  let ipAddress: string | undefined;
  const notes: string[] = [];

  const mapData = extractFromStringMap(item.string_map_data);
  device = mapData.device;
  location = mapData.location;
  ipAddress = mapData.ip;
  if (mapData.label && mapData.label !== label) notes.push(mapData.label);

  const stringList = item.string_list_data;
  if (Array.isArray(stringList)) {
    for (const entry of stringList) {
      if (!isRecord(entry)) continue;
      const ts = parseTimestamp(entry.timestamp ?? entry.timestamp_ms);
      if (ts) timestamp = ts;
      const value =
        typeof entry.value === "string" ? entry.value.trim() : undefined;
      if (value) {
        const lower = value.toLowerCase();
        if (
          lower.includes("iphone") ||
          lower.includes("android") ||
          lower.includes("chrome") ||
          lower.includes("safari") ||
          lower.includes("mobile") ||
          lower.includes("windows") ||
          lower.includes("mac")
        ) {
          device = device ? `${device}; ${value}` : value;
        } else if (value.match(/\d+\.\d+\.\d+\.\d+/)) {
          ipAddress = ipAddress ?? value;
        } else if (!device && value.length < 80) {
          device = device ? `${device}; ${value}` : value;
        } else if (!location) {
          location = value;
        }
      }
    }
  }

  device =
    device ||
    pickString(item, DEVICE_KEYS) ||
    pickString(item, ["user_agent", "browser"]);
  ipAddress =
    ipAddress || pickString(item, ["ip_address", "ip", "ipAddress"]);
  location =
    location ||
    buildLocation([
      pickString(item, ["city"]),
      pickString(item, ["region", "state"]),
      pickString(item, ["country"]),
      pickString(item, ["location"]),
    ]);

  if (!timestamp && !label) return null;

  const dateLabel = timestamp ? formatTimestamp(timestamp) : undefined;

  let severity: SecurityEvent["severity"] = "low";
  if (type === "password_change") severity = "high";
  else if (type === "privacy_change") severity = "medium";
  else if (!device && !location) severity = "medium";

  return {
    id: stableId([type, sourcePath, index, timestamp, label]),
    type,
    label,
    timestamp,
    dateLabel,
    location,
    device,
    ipAddress,
    sourcePath,
    severity,
    notes: notes.length ? notes : undefined,
  };
}

function extractEventsFromData(
  data: unknown,
  type: SecurityEventType,
  defaultLabel: string,
  sourcePath: string
): SecurityEvent[] {
  const events: SecurityEvent[] = [];
  let index = 0;

  function walk(node: unknown): void {
    if (Array.isArray(node)) {
      for (const item of node) {
        if (isRecord(item)) {
          const event = eventFromRecord(
            item,
            type,
            defaultLabel,
            sourcePath,
            index++
          );
          if (event) events.push(event);
          walk(item);
        }
      }
      return;
    }
    if (!isRecord(node)) return;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) walk(value);
    }
  }

  walk(data);

  const seen = new Set<string>();
  return events.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
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
    "account_history_account_creation",
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

function findFileEvents(
  files: Map<string, string>,
  rule: (typeof FILE_RULES)[number]
): { events: SecurityEvent[]; count: number } {
  const target = rule.fragment.toLowerCase();
  const events: SecurityEvent[] = [];
  let count = 0;

  for (const [path, content] of files) {
    const lower = path.toLowerCase().replace(/\\/g, "/");
    if (!lower.includes(target)) continue;
    try {
      const data = JSON.parse(content);
      count += countItems(data);
      events.push(
        ...extractEventsFromData(data, rule.type, rule.label, path)
      );
    } catch {
      continue;
    }
  }

  return { events, count };
}

export function parseSecurity(files: Map<string, string>): SecurityData | null {
  const allEvents: SecurityEvent[] = [];
  const counts = {
    loginCount: 0,
    logoutCount: 0,
    profileActivityCount: 0,
    privacyChangeCount: 0,
    passwordChangeCount: 0,
  };

  for (const rule of FILE_RULES) {
    const { events, count } = findFileEvents(files, rule);
    allEvents.push(...events);

    switch (rule.type) {
      case "login":
        counts.loginCount += count || events.filter((e) => e.type === "login").length;
        break;
      case "logout":
        counts.logoutCount += count || events.filter((e) => e.type === "logout").length;
        break;
      case "profile_activity":
        counts.profileActivityCount +=
          count || events.filter((e) => e.type === "profile_activity").length;
        break;
      case "privacy_change":
        counts.privacyChangeCount +=
          count || events.filter((e) => e.type === "privacy_change").length;
        break;
      case "password_change":
        counts.passwordChangeCount +=
          count || events.filter((e) => e.type === "password_change").length;
        break;
      default:
        break;
    }
  }

  const hasData =
    counts.loginCount > 0 ||
    counts.logoutCount > 0 ||
    counts.profileActivityCount > 0 ||
    counts.privacyChangeCount > 0 ||
    counts.passwordChangeCount > 0 ||
    allEvents.length > 0;

  if (!hasData) return null;

  const events = allEvents.sort(
    (a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0)
  );

  const base: SecurityData = {
    ...counts,
    events,
  };

  return {
    ...base,
    suspiciousLoginAnalysis: analyzeSuspiciousLogins(base),
  };
}
