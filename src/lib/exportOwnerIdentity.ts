import { normalizeIdentityKey } from "@/lib/identityResolver";
import type { DmAnalytics } from "@/types/instagram";
import type { NameConfidence } from "@/types/insights";

export interface ExportOwnerIdentity {
  keys: Set<string>;
  usernames: string[];
  displayNames: string[];
  confidence: NameConfidence;
  sources: string[];
}

const PROFILE_PATH_PATTERNS = [
  /personal_information/i,
  /account_information/i,
  /profile_information/i,
  /account_profile/i,
];

const USERNAME_LABEL = /^(user\s*name|handle)$/i;
const NAME_LABEL = /^(name|full\s*name|display\s*name)$/i;

type ProfileStrings = { usernames: string[]; names: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addKey(keys: Set<string>, raw: string): void {
  if (!raw?.trim()) return;
  keys.add(normalizeIdentityKey(raw));
}

function collectLabeled(label: string, value: unknown, out: ProfileStrings): void {
  if (typeof value !== "string" || !value.trim()) return;
  const l = label.trim();
  if (USERNAME_LABEL.test(l)) out.usernames.push(value.trim());
  else if (NAME_LABEL.test(l)) out.names.push(value.trim());
}

/**
 * Instagram writes profile fields as `string_map_data: { Username: { value }, Name: { value } }`;
 * newer exports also use `{ label, value }` rows. Only exact field labels count, so
 * unrelated strings in the profile folder never become owner keys.
 */
function extractProfileStrings(data: unknown, out: ProfileStrings, depth = 0): void {
  if (depth > 8) return;
  if (Array.isArray(data)) {
    for (const item of data) extractProfileStrings(item, out, depth + 1);
    return;
  }
  if (!isRecord(data)) return;

  const stringMap = data.string_map_data;
  if (isRecord(stringMap)) {
    for (const [label, entry] of Object.entries(stringMap)) {
      if (isRecord(entry)) collectLabeled(label, entry.value, out);
    }
  } else if (Array.isArray(stringMap)) {
    for (const entry of stringMap) {
      if (!isRecord(entry)) continue;
      if (typeof entry.label === "string") collectLabeled(entry.label, entry.value, out);
      if (isRecord(entry.map)) {
        for (const [label, value] of Object.entries(entry.map)) {
          collectLabeled(label, isRecord(value) ? value.value : value, out);
        }
      }
    }
  }

  if (typeof data.label === "string") collectLabeled(data.label, data.value, out);

  for (const value of Object.values(data)) {
    if (value === stringMap) continue;
    if (Array.isArray(value) || isRecord(value)) {
      extractProfileStrings(value, out, depth + 1);
    }
  }
}

function parseProfileFromFiles(
  files: Map<string, string> | undefined
): ProfileStrings & { paths: string[] } {
  const out: ProfileStrings = { usernames: [], names: [] };
  const paths: string[] = [];
  if (!files?.size) return { ...out, paths };

  for (const [path, content] of files) {
    const lower = path.toLowerCase().replace(/\\/g, "/");
    if (!PROFILE_PATH_PATTERNS.some((p) => p.test(lower))) continue;
    try {
      const before = out.usernames.length + out.names.length;
      extractProfileStrings(JSON.parse(content) as unknown, out);
      if (out.usernames.length + out.names.length > before) paths.push(path);
    } catch {
      continue;
    }
  }

  return { ...out, paths };
}

/**
 * The export owner is a participant in every thread, so the name present in the
 * most threads wins; message volume only breaks ties.
 */
function inferFromThreadPresence(
  messages: DmAnalytics | null | undefined
): {
  name: string;
  threadCount: number;
  totalThreads: number;
  runnerUpThreads: number;
} | null {
  const threads = messages?.threads ?? [];
  if (!threads.length) return null;

  const stats = new Map<string, { name: string; threads: number; messages: number }>();
  for (const thread of threads) {
    const seen = new Set<string>();
    const names = [
      ...(thread.participants ?? []),
      ...Object.keys(thread.messagesBySender ?? {}),
    ];
    for (const raw of names) {
      if (!raw?.trim()) continue;
      const key = normalizeIdentityKey(raw);
      const entry = stats.get(key) ?? { name: raw.trim(), threads: 0, messages: 0 };
      if (!seen.has(key)) {
        seen.add(key);
        entry.threads++;
      }
      stats.set(key, entry);
    }
    for (const [sender, count] of Object.entries(thread.messagesBySender ?? {})) {
      const entry = stats.get(normalizeIdentityKey(sender));
      if (entry && count) entry.messages += count;
    }
  }

  const ranked = [...stats.values()].sort(
    (a, b) => b.threads - a.threads || b.messages - a.messages
  );
  const top = ranked[0];
  if (!top) return null;
  return {
    name: top.name,
    threadCount: top.threads,
    totalThreads: threads.length,
    runnerUpThreads: ranked[1]?.threads ?? 0,
  };
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

  const presence = inferFromThreadPresence(messages);
  if (presence && !keys.has(normalizeIdentityKey(presence.name))) {
    const unique = presence.threadCount > presence.runnerUpThreads;
    const share = presence.threadCount / presence.totalThreads;
    // With profile names already known, only add a DM display name that is clearly the owner.
    const accept =
      confidence === "high"
        ? unique && presence.totalThreads >= 3 && share >= 0.9
        : true;
    if (accept) {
      addKey(keys, presence.name);
      displayNames.push(presence.name);
      sources.push(
        `Name in ${presence.threadCount.toLocaleString()} of ${presence.totalThreads.toLocaleString()} DM threads`
      );
      if (confidence !== "high") {
        confidence =
          unique && presence.totalThreads >= 3 && share >= 0.8 ? "medium" : "low";
      }
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

/** Exact (case/whitespace-insensitive) match against the owner's names — no fuzzy keys. */
export function isExportOwnerName(
  name: string,
  owner: ExportOwnerIdentity
): boolean {
  if (!name?.trim() || owner.keys.size === 0) return false;
  return owner.keys.has(normalizeIdentityKey(name));
}
