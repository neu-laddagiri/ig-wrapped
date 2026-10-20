import { parseTimestamp } from "@/lib/formatters";
import type { ConnectedApp } from "@/types/insights";

type JsonRecord = Record<string, unknown>;

function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseConnectedApps(files: Map<string, string>): ConnectedApp[] {
  const apps: ConnectedApp[] = [];
  const seen = new Set<string>();

  for (const [path, content] of files) {
    const lower = path.toLowerCase().replace(/\\/g, "/");
    if (
      !lower.includes("apps_and_websites") &&
      !lower.includes("apps_and_websites_off_of_instagram")
    ) {
      continue;
    }
    try {
      const data = JSON.parse(content);
      walkApps(data, apps, seen);
    } catch {
      continue;
    }
  }

  return apps;
}

/** Exports usually keep dates as { "Added on": { timestamp } } in string_map_data. */
function timestampsFromStringMap(map: unknown): {
  added?: number;
  lastUsed?: number;
} {
  const out: { added?: number; lastUsed?: number } = {};
  if (!isRecord(map)) return out;
  for (const [key, entry] of Object.entries(map)) {
    if (!isRecord(entry)) continue;
    const ts = parseTimestamp(entry.timestamp);
    if (!ts) continue;
    if (/last|used|active|updated/i.test(key)) out.lastUsed ??= ts;
    else out.added ??= ts;
  }
  return out;
}

function walkApps(
  node: unknown,
  apps: ConnectedApp[],
  seen: Set<string>
): void {
  if (Array.isArray(node)) {
    node.forEach((item) => walkApps(item, apps, seen));
    return;
  }
  if (!isRecord(node)) return;

  const name =
    (typeof node.name === "string" && node.name.trim()) ||
    (typeof node.title === "string" && node.title.trim()) ||
    (typeof node.app_name === "string" && node.app_name.trim());
  const mapped = timestampsFromStringMap(node.string_map_data);
  const addedAt =
    parseTimestamp(node.added ?? node.created ?? node.timestamp) ??
    mapped.added;
  const lastUsedAt =
    parseTimestamp(node.last_used ?? node.updated) ?? mapped.lastUsed;

  if (name && !seen.has(name.toLowerCase())) {
    seen.add(name.toLowerCase());
    const now = Date.now();
    const staleThreshold = 365 * 24 * 60 * 60 * 1000;
    const last = lastUsedAt ?? addedAt;
    apps.push({
      name,
      addedAt,
      lastUsedAt,
      // No date in the export means unknown, not stale.
      isStale: last ? now - last * 1000 > staleThreshold : false,
    });
  }

  for (const val of Object.values(node)) {
    if (Array.isArray(val) || isRecord(val)) walkApps(val, apps, seen);
  }
}
