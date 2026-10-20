import { formatMonthKey, parseTimestamp } from "@/lib/formatters";
import { isValidAccountName, isGenericSearchLabel } from "@/lib/accountNameFilter";
import type { SearchWrappedResult } from "@/types/insights";

type JsonRecord = Record<string, unknown>;
type SearchKind = "account" | "term";
type SearchHit = { query: string; ts?: number; kind?: SearchKind };

function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const SEARCH_FOLDERS = [
  "your_instagram_activity/searches/",
  "your_instagram_activity/recent_searches/",
  "logged_information/searches/",
  "logged_information/recent_searches/",
  "recent_searches/",
  "search_history",
  "your_search_history",
];

function isSearchPath(path: string): boolean {
  const lower = path.toLowerCase().replace(/\\/g, "/");
  if (!lower.endsWith(".json") || lower.includes("/messages/")) return false;
  if (SEARCH_FOLDERS.some((folder) => lower.includes(folder))) return true;
  // Otherwise only the file name may mark it (a DM folder like "researchgate_99" must not).
  const fileName = lower.slice(lower.lastIndexOf("/") + 1);
  return fileName.includes("search");
}

/** The file says what was searched: account_searches.json vs word_or_phrase/tag searches. */
function kindFromPath(path: string): SearchKind | undefined {
  const fileName = path.toLowerCase().replace(/\\/g, "/").split("/").pop() ?? "";
  if (/account|profile|user/.test(fileName)) return "account";
  if (/word|phrase|keyword|tag|hashtag|place/.test(fileName)) return "term";
  return undefined;
}

function acceptQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const q = raw.trim();
  if (q.length <= 1 || q.length >= 120) return null;
  if (q.startsWith("http") || isGenericSearchLabel(q)) return null;
  return q;
}

/** { Search: {value}, Time: {timestamp} } — the time is a sibling of the query. */
function hitFromStringMap(map: JsonRecord): SearchHit | null {
  let query: string | null = null;
  let ts: number | undefined;
  for (const [key, entry] of Object.entries(map)) {
    if (!isRecord(entry)) continue;
    const k = key.trim().toLowerCase();
    const t = parseTimestamp(entry.timestamp);
    if (t && (k === "time" || !ts)) ts = t;
    if (!query && /search|query|value|name|user/.test(k)) {
      query = acceptQuery(entry.value);
    }
  }
  return query ? { query, ts } : null;
}

function extractSearchEntries(data: unknown): SearchHit[] {
  const results: SearchHit[] = [];

  function walk(node: unknown): void {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!isRecord(node)) return;

    // Each record is one search — stop once it's counted so nested copies of
    // the same query (title + string_list_data value) aren't counted again.
    if (isRecord(node.string_map_data)) {
      const hit = hitFromStringMap(node.string_map_data);
      if (hit) {
        results.push(hit);
        return;
      }
    }

    if (Array.isArray(node.string_list_data)) {
      let found = false;
      for (const entry of node.string_list_data) {
        if (!isRecord(entry)) continue;
        const q = acceptQuery(entry.value) ?? acceptQuery(node.title);
        if (!q) continue;
        results.push({
          query: q,
          ts: parseTimestamp(entry.timestamp ?? entry.timestamp_ms),
        });
        found = true;
      }
      if (found) return;
    }

    const ts = parseTimestamp(
      node.timestamp ?? node.timestamp_ms ?? node.creation_timestamp
    );
    for (const field of [
      node.query,
      node.search_query,
      node.text,
      node.title,
      node.label,
      node.value,
    ]) {
      const q = acceptQuery(field);
      if (q && (isValidAccountName(q) || q.includes(" ") || q.startsWith("@"))) {
        results.push({ query: q, ts });
        return;
      }
    }

    for (const val of Object.values(node)) {
      if (Array.isArray(val) || isRecord(val)) walk(val);
    }
  }

  walk(data);
  return results;
}

export function parseSearchHistory(
  files: Map<string, string>
): SearchWrappedResult | null {
  const all: SearchHit[] = [];
  const filesParsed: string[] = [];

  for (const [path, content] of files) {
    if (!isSearchPath(path)) continue;
    try {
      const kind = kindFromPath(path);
      const entries = extractSearchEntries(JSON.parse(content));
      if (entries.length) {
        filesParsed.push(path);
        for (const entry of entries) all.push({ ...entry, kind });
      }
    } catch {
      continue;
    }
  }

  if (!all.length) return null;

  const counts = new Map<
    string,
    { count: number; lastAt?: number; kind?: SearchKind }
  >();
  for (const { query, ts, kind } of all) {
    const key = query.toLowerCase();
    const existing = counts.get(key) ?? { count: 0 };
    counts.set(key, {
      count: existing.count + 1,
      lastAt: ts && (!existing.lastAt || ts > existing.lastAt) ? ts : existing.lastAt,
      kind: existing.kind ?? kind,
    });
  }

  const entries = [...counts.entries()]
    .map(([query, { count, lastAt, kind }]) => ({
      query,
      count,
      lastSearchedAt: lastAt,
      type:
        kind ??
        (query.startsWith("@") ||
        (!query.includes(" ") && isValidAccountName(query))
          ? ("account" as const)
          : ("term" as const)),
    }))
    .sort((a, b) => b.count - a.count);

  const repeated = entries.filter((e) => e.count >= 2).slice(0, 15);
  const labels: string[] = [];
  if (repeated.length >= 3) labels.push("Curiosity Loop");
  if (repeated.some((e) => e.count >= 5)) labels.push("Repeat Search");

  const monthCounts = new Map<string, number>();
  for (const { ts } of all) {
    if (!ts) continue;
    const m = formatMonthKey(ts);
    if (m !== "unknown") monthCounts.set(m, (monthCounts.get(m) ?? 0) + 1);
  }
  const searchTimeline = [...monthCounts.entries()]
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  return {
    totalSearches: all.length,
    topAccounts: entries.filter((e) => e.type === "account").slice(0, 15),
    topTerms: entries.filter((e) => e.type === "term").slice(0, 15),
    repeatedSearches: repeated,
    labels,
    filesParsed,
    searchTimeline,
    privacyNote:
      "Instagram export may only include search history retained in this download. Search history can be extremely private — cloud saves keep only your top searches and counts, not the full history.",
  };
}
