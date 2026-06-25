import { parseTimestamp } from "@/lib/formatters";
import { isValidAccountName } from "@/lib/accountNameFilter";
import type { SearchWrappedResult } from "@/types/insights";

type JsonRecord = Record<string, unknown>;

function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isSearchPath(path: string): boolean {
  const lower = path.toLowerCase().replace(/\\/g, "/");
  if (
    lower.includes("your_instagram_activity/searches") ||
    lower.includes("your_instagram_activity/recent_searches") ||
    lower.includes("logged_information/searches") ||
    lower.includes("recent_searches") ||
    lower.includes("search_history") ||
    lower.includes("your_search_history")
  ) {
    return true;
  }
  return (
    (lower.includes("search") || lower.includes("searches")) &&
    lower.endsWith(".json")
  );
}

function extractSearchEntries(data: unknown): { query: string; ts?: number }[] {
  const results: { query: string; ts?: number }[] = [];

  function walk(node: unknown): void {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!isRecord(node)) return;

    const queryFields = [
      node.query,
      node.search_query,
      node.text,
      node.title,
      node.label,
      node.value,
    ];
    const ts = parseTimestamp(
      node.timestamp ?? node.timestamp_ms ?? node.creation_timestamp
    );

    for (const field of queryFields) {
      if (typeof field === "string") {
        const q = field.trim();
        if (q.length > 1 && q.length < 120 && !q.startsWith("http")) {
          if (isValidAccountName(q) || q.includes(" ") || q.startsWith("@")) {
            results.push({ query: q, ts });
          }
        }
      }
    }

    if (Array.isArray(node.entries)) {
      walk(node.entries);
    }

    if (Array.isArray(node.string_list_data)) {
      for (const entry of node.string_list_data) {
        if (!isRecord(entry)) continue;
        const v =
          typeof entry.value === "string" ? entry.value.trim() : undefined;
        const t = parseTimestamp(entry.timestamp ?? entry.timestamp_ms);
        if (v && v.length > 1 && v.length < 120 && !v.startsWith("http")) {
          results.push({ query: v, ts: t });
        }
      }
    }

    for (const val of Object.values(node)) {
      if (Array.isArray(val) || isRecord(val)) walk(val);
    }
  }

  walk(data);
  return results;
}

function monthKey(ts?: number): string | undefined {
  if (!ts) return undefined;
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return undefined;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function parseSearchHistory(
  files: Map<string, string>
): SearchWrappedResult | null {
  const all: { query: string; ts?: number }[] = [];
  const filesParsed: string[] = [];

  for (const [path, content] of files) {
    if (!isSearchPath(path)) continue;
    try {
      const entries = extractSearchEntries(JSON.parse(content));
      if (entries.length) {
        filesParsed.push(path);
        all.push(...entries);
      }
    } catch {
      continue;
    }
  }

  if (!all.length) return null;

  const counts = new Map<string, { count: number; lastAt?: number }>();
  for (const { query, ts } of all) {
    const key = query.toLowerCase();
    const existing = counts.get(key) ?? { count: 0 };
    counts.set(key, {
      count: existing.count + 1,
      lastAt: ts && (!existing.lastAt || ts > existing.lastAt) ? ts : existing.lastAt,
    });
  }

  const entries = [...counts.entries()]
    .map(([query, { count, lastAt }]) => ({
      query,
      count,
      lastSearchedAt: lastAt,
      type:
        query.startsWith("@") || (!query.includes(" ") && isValidAccountName(query))
          ? ("account" as const)
          : ("term" as const),
    }))
    .sort((a, b) => b.count - a.count);

  const repeated = entries.filter((e) => e.count >= 2).slice(0, 15);
  const labels: string[] = [];
  if (repeated.length >= 3) labels.push("Curiosity Loop");
  if (repeated.some((e) => e.count >= 5)) labels.push("Repeat Search");

  const monthCounts = new Map<string, number>();
  for (const { ts } of all) {
    const m = monthKey(ts);
    if (m) monthCounts.set(m, (monthCounts.get(m) ?? 0) + 1);
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
      "Search history can be extremely private. This summary uses parsed counts only — raw search text is not saved to cloud.",
  };
}
