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
  const addedAt = parseTimestamp(node.added ?? node.created ?? node.timestamp);
  const lastUsedAt = parseTimestamp(node.last_used ?? node.updated);

  if (name && !seen.has(name.toLowerCase())) {
    seen.add(name.toLowerCase());
    const now = Date.now();
    const staleThreshold = 365 * 24 * 60 * 60 * 1000;
    const last = lastUsedAt ?? addedAt;
    apps.push({
      name,
      addedAt,
      lastUsedAt,
      isStale: last ? now - last * 1000 > staleThreshold : true,
    });
  }

  for (const val of Object.values(node)) {
    if (Array.isArray(val) || isRecord(val)) walkApps(val, apps, seen);
  }
}
