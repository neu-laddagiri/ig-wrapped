import {
  compactIdentityKey,
  normalizeIdentityKey,
} from "@/lib/identityResolver";
import type { DmAnalytics } from "@/types/instagram";
import type { NameConfidence } from "@/types/insights";

export interface ExportOwnerIdentity {
  keys: Set<string>;
  usernames: string[];
  displayNames: string[];
  confidence: NameConfidence;
  sources: string[];
}

function addKey(keys: Set<string>, raw: string): void {
  if (!raw?.trim()) return;
  keys.add(normalizeIdentityKey(raw));
  const compact = compactIdentityKey(raw);
  if (compact.length >= 2) keys.add(compact);
}

function parseProfileFromFiles(
  files: Map<string, string> | undefined
): { usernames: string[]; names: string[]; paths: string[] } {
  const usernames: string[] = [];
  const names: string[] = [];
  const paths: string[] = [];

  if (!files?.size) return { usernames, names, paths };

  const pathPatterns = [
    /personal_information/i,
    /account_information/i,
    /profile_information/i,
    /account_profile/i,
  ];

  const valuePatterns = [
    /username/i,
    /name/i,
    /display/i,
    /account/i,
  ];

  for (const [path, content] of files) {
    const lower = path.toLowerCase().replace(/\\/g, "/");
    if (!pathPatterns.some((p) => p.test(lower))) continue;

    try {
      const data = JSON.parse(content) as unknown;
      extractProfileStrings(data, valuePatterns, usernames, names);
      paths.push(path);
    } catch {
      continue;
    }
  }

  return { usernames, names, paths };
}

function extractProfileStrings(
  data: unknown,
  keyPatterns: RegExp[],
  usernames: string[],
  names: string[]
): void {
  if (Array.isArray(data)) {
    data.forEach((item) =>
      extractProfileStrings(item, keyPatterns, usernames, names)
    );
    return;
  }
  if (typeof data !== "object" || data === null) return;

  const obj = data as Record<string, unknown>;

  if (Array.isArray(obj.string_map_data)) {
    for (const entry of obj.string_map_data) {
      if (typeof entry !== "object" || entry === null) continue;
      const row = entry as Record<string, unknown>;
      const map = row.map;
      if (typeof map === "object" && map !== null) {
        for (const [k, v] of Object.entries(map as Record<string, unknown>)) {
          if (typeof v !== "string" || !v.trim()) continue;
          if (/username|handle/i.test(k)) usernames.push(v.trim());
          else if (/name/i.test(k)) names.push(v.trim());
        }
      }
      if (typeof row.value === "string" && row.value.trim()) {
        const label = typeof row.label === "string" ? row.label : "";
        if (/username/i.test(label)) usernames.push(row.value.trim());
        else if (/name/i.test(label)) names.push(row.value.trim());
      }
    }
  }

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && value.trim() && keyPatterns.some((p) => p.test(key))) {
      if (/username|handle/i.test(key)) usernames.push(value.trim());
      else names.push(value.trim());
    }
    if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
      extractProfileStrings(value, keyPatterns, usernames, names);
    }
  }
}

function inferFromTopSender(
  messages: DmAnalytics | null | undefined
): { name: string; total: number; margin: number } | null {
  if (!messages?.threads?.length) return null;

  const totals = new Map<string, number>();
  for (const thread of messages.threads) {
    for (const [sender, count] of Object.entries(thread.messagesBySender ?? {})) {
      if (!sender?.trim() || !count) continue;
      totals.set(sender.trim(), (totals.get(sender.trim()) ?? 0) + count);
    }
  }

  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const second = ranked[1];
  if (!top || top[1] < 15) return null;

  const margin = second ? top[1] / Math.max(second[1], 1) : top[1];
  return { name: top[0], total: top[1], margin };
}

export function resolveExportOwnerIdentity(params: {
  files?: Map<string, string>;
  messages?: DmAnalytics | null;
}): ExportOwnerIdentity {
  const { files, messages } = params;
  const keys = new Set<string>();
  const usernames: string[] = [];
  const displayNames: string[] = [];
  const sources: string[] = [];
  let confidence: NameConfidence = "low";

  const profile = parseProfileFromFiles(files);
  for (const u of profile.usernames) {
    usernames.push(u);
    addKey(keys, u);
  }
  for (const n of profile.names) {
    displayNames.push(n);
    addKey(keys, n);
  }
  if (profile.paths.length > 0) {
    sources.push(`Profile export: ${profile.paths[0]}`);
    confidence = "high";
  }

  const topSender = inferFromTopSender(messages);
  if (topSender) {
    addKey(keys, topSender.name);
    displayNames.push(topSender.name);
    sources.push(
      `Top DM sender (${topSender.total.toLocaleString()} messages across threads)`
    );
    if (confidence !== "high") {
      confidence = topSender.margin >= 1.4 ? "medium" : "low";
    }
  }

  if (keys.size === 0) {
    sources.push("Could not determine export owner — sender split unavailable");
  }

  return {
    keys,
    usernames: [...new Set(usernames)],
    displayNames: [...new Set(displayNames)],
    confidence,
    sources,
  };
}

export function isExportOwnerName(
  name: string,
  owner: ExportOwnerIdentity
): boolean {
  if (!name?.trim() || owner.keys.size === 0) return false;
  const k = normalizeIdentityKey(name);
  const c = compactIdentityKey(name);
  return owner.keys.has(k) || owner.keys.has(c);
}
