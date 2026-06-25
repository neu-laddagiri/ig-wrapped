import { formatMonthKey, formatMonthLabel } from "@/lib/formatters";
import { parseActivityTimelineFromFiles } from "@/lib/activityTimelineParser";
import type { MonthlyActivityByType } from "@/lib/activityTimelineParser";
import { computeMostActiveEra } from "@/lib/mostActiveEra";
import type {
  ActivityTypeKey,
  DmAnalytics,
  MostActiveEraData,
  NetworkStats,
  ParsedExportData,
  SecurityData,
} from "@/types/instagram";
import type { SearchWrappedResult } from "@/types/insights";

/** Grouped categories used for era labeling */
export type EraGroupKey =
  | "dms"
  | "story"
  | "doomscroll"
  | "likes"
  | "comments"
  | "saves"
  | "follows"
  | "ads"
  | "searches"
  | "accountEvents";

const GROUP_LABELS: Record<EraGroupKey, string> = {
  dms: "DMs",
  story: "Story views",
  doomscroll: "Posts/videos viewed",
  likes: "Likes",
  comments: "Comments",
  saves: "Saved posts",
  follows: "Follows",
  ads: "Ad views",
  searches: "Searches",
  accountEvents: "Account events",
};

const TYPE_TO_GROUP: Partial<Record<ActivityTypeKey, EraGroupKey>> = {
  dms: "dms",
  storiesViewed: "story",
  storyLikes: "story",
  pollInteractions: "story",
  emojiSliders: "story",
  quizzes: "story",
  videosWatched: "doomscroll",
  postsViewed: "doomscroll",
  likedPosts: "likes",
  likedComments: "likes",
  postComments: "comments",
  savedPosts: "saves",
  following: "follows",
  followers: "follows",
  adsVideosWatched: "ads",
  adsPostsViewed: "ads",
};

type MonthSources = Set<"export_files" | "dm_parser" | "network" | "security" | "search">;

export type MonthlyGroupMap = Map<string, Map<EraGroupKey, number>>;

function createMonthlyGroups(): MonthlyGroupMap {
  return new Map();
}

function addGroupCount(
  map: MonthlyGroupMap,
  month: string,
  group: EraGroupKey,
  count: number,
  source: MonthSources extends Set<infer S> ? S : never
): void {
  if (!month || month === "unknown" || count <= 0) return;
  let groups = map.get(month);
  if (!groups) {
    groups = new Map();
    map.set(month, groups);
  }
  groups.set(group, (groups.get(group) ?? 0) + count);
}

const monthSources = new Map<string, MonthSources>();

function markSource(month: string, source: MonthSources extends Set<infer S> ? S : never) {
  let s = monthSources.get(month);
  if (!s) {
    s = new Set();
    monthSources.set(month, s);
  }
  s.add(source);
}

function mergeActivityTypes(
  map: MonthlyGroupMap,
  activity: MonthlyActivityByType
): void {
  for (const [type, monthMap] of activity) {
    const group = TYPE_TO_GROUP[type];
    if (!group || !monthMap) continue;
    for (const [month, count] of monthMap) {
      addGroupCount(map, month, group, count, "export_files");
      markSource(month, "export_files");
    }
  }
}

function addDmMonths(map: MonthlyGroupMap, messages: DmAnalytics | null): void {
  if (!messages?.messagesByMonth?.length) return;
  for (const { month, count } of messages.messagesByMonth) {
    addGroupCount(map, month, "dms", count, "dm_parser");
    markSource(month, "dm_parser");
  }
}

function addNetworkMonths(map: MonthlyGroupMap, network: NetworkStats | null): void {
  if (!network) return;
  for (const account of network.following) {
    if (!account.timestamp) continue;
    const month = formatMonthKey(account.timestamp);
    addGroupCount(map, month, "follows", 1, "network");
    markSource(month, "network");
  }
  for (const account of network.followers) {
    if (!account.timestamp) continue;
    const month = formatMonthKey(account.timestamp);
    addGroupCount(map, month, "follows", 1, "network");
    markSource(month, "network");
  }
}

function addSecurityMonths(map: MonthlyGroupMap, security: SecurityData | null): void {
  const seen = new Set<string>();
  for (const e of security?.events ?? []) {
    if (!e.timestamp) continue;
    const dedupeKey = e.id || `${e.type}-${e.timestamp}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const month = formatMonthKey(e.timestamp);
    addGroupCount(map, month, "accountEvents", 1, "security");
    markSource(month, "security");
  }
}

function addSearchMonths(
  map: MonthlyGroupMap,
  search: SearchWrappedResult | null | undefined
): void {
  for (const { month, count } of search?.searchTimeline ?? []) {
    addGroupCount(map, month, "searches", count, "search");
    markSource(month, "search");
  }
}

function addAdsFromFiles(map: MonthlyGroupMap, files?: Map<string, string>): void {
  if (!files?.size) return;
  for (const [path, content] of files) {
    const lower = path.toLowerCase();
    if (!lower.includes("ads_viewed") && !lower.includes("ads_clicked")) continue;
    try {
      const data = JSON.parse(content);
      const timestamps = extractUniqueTimestamps(data);
      for (const ts of timestamps) {
        const month = formatMonthKey(ts);
        addGroupCount(map, month, "ads", 1, "export_files");
        markSource(month, "export_files");
      }
    } catch {
      continue;
    }
  }
}

function extractUniqueTimestamps(data: unknown): number[] {
  const seen = new Set<number>();
  const out: number[] = [];

  function walk(node: unknown): void {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const rec = node as Record<string, unknown>;

    const stringList = rec.string_list_data;
    if (Array.isArray(stringList) && stringList.length > 0) {
      for (const entry of stringList) {
        if (typeof entry !== "object" || entry === null) continue;
        const e = entry as Record<string, unknown>;
        const ts = parseTs(e.timestamp ?? e.timestamp_ms);
        if (ts && !seen.has(ts)) {
          seen.add(ts);
          out.push(ts);
        }
      }
      return;
    }

    const direct = parseTs(
      rec.timestamp ?? rec.timestamp_ms ?? rec.creation_timestamp
    );
    if (direct) {
      if (!seen.has(direct)) {
        seen.add(direct);
        out.push(direct);
      }
      return;
    }

    for (const value of Object.values(rec)) {
      if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
        walk(value);
      }
    }
  }

  walk(data);
  return out;
}

function parseTs(v: unknown): number | undefined {
  if (typeof v === "number" && v > 0) {
    return v > 1e12 ? Math.floor(v / 1000) : v;
  }
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n) && n > 0) return n > 1e12 ? Math.floor(n / 1000) : n;
  }
  return undefined;
}

export function buildMonthlyGroupMap(
  parsed: ParsedExportData,
  files?: Map<string, string>,
  searchWrapped?: SearchWrappedResult | null
): MonthlyGroupMap {
  monthSources.clear();
  const map = createMonthlyGroups();

  if (files?.size) {
    mergeActivityTypes(map, parseActivityTimelineFromFiles(files));
    addAdsFromFiles(map, files);
  }

  addDmMonths(map, parsed.messages);
  addNetworkMonths(map, parsed.network);
  addSecurityMonths(map, parsed.security);
  addSearchMonths(map, searchWrapped);

  return map;
}

export function monthTotal(groups: Map<EraGroupKey, number>): number {
  let t = 0;
  for (const c of groups.values()) t += c;
  return t;
}

export function topGroupsForMonth(
  groups: Map<EraGroupKey, number>,
  limit = 3
): { key: EraGroupKey; count: number; label: string }[] {
  return [...groups.entries()]
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count, label: GROUP_LABELS[key] }));
}

export function inferEraFromGroups(
  groups: Map<EraGroupKey, number>
): {
  eraName: string;
  caption: string;
  dominanceLine: string;
  topGroup: EraGroupKey;
  topCount: number;
} {
  const total = monthTotal(groups);
  const ranked = topGroupsForMonth(groups, 3);
  const top = ranked[0];
  const second = ranked[1];

  if (!top || total === 0) {
    return {
      eraName: "Ghost Mode Era",
      caption: "Light activity — quiet month.",
      dominanceLine: "Very little tracked activity.",
      topGroup: "dms",
      topCount: 0,
    };
  }

  const topShare = top.count / total;
  const isMixed =
    topShare < 0.35 ||
    (second && second.count / total > 0.25 && top.count - second.count < total * 0.1);

  const dominanceLine =
    ranked.length >= 2
      ? `Dominated by ${ranked[0].label.toLowerCase()} and ${ranked[1].label.toLowerCase()}.`
      : `Dominated by ${ranked[0].label.toLowerCase()}.`;

  if (isMixed) {
    return {
      eraName: "Mixed Activity Era",
      caption: "Your feed and inbox were both working overtime.",
      dominanceLine,
      topGroup: top.key,
      topCount: top.count,
    };
  }

  const accountEvents = groups.get("accountEvents") ?? 0;
  const accountDominates =
    top.key === "accountEvents" &&
    accountEvents >= Math.max(3, (second?.count ?? 0) * 1.15);

  if (accountDominates) {
    return {
      eraName: "Account Changes Era",
      caption:
        "This month had unusual account/profile activity worth reviewing.",
      dominanceLine,
      topGroup: "accountEvents",
      topCount: accountEvents,
    };
  }

  // If security exists but isn't top, don't label as account era
  const effectiveTop = top.key === "accountEvents" && second ? second : top;

  const captions: Record<EraGroupKey, string> = {
    dms: "Your inbox was basically a second home this month.",
    story: "You were deep in the story-watching trenches this month.",
    doomscroll: "Peak scroll mode. The algorithm had you seated.",
    likes: "You were handing out likes like confetti.",
    comments: "You were commenting up a storm this month.",
    saves: "Curator mode — saving posts for later.",
    follows: "Network growth was the main event this month.",
    ads: "Ads were showing up more than usual in your export.",
    searches: "Search curiosity spiked this month.",
    accountEvents:
      "This month had unusual account/profile activity worth reviewing.",
  };

  const eraNames: Record<EraGroupKey, string> = {
    dms: "DM Peak Era",
    story: "Story Watcher Era",
    doomscroll: "Doomscroll Era",
    likes: "Generous Liker Era",
    comments: "Comment Era",
    saves: "Save It For Later Era",
    follows: "Follow Spree Era",
    ads: "Ad Exposure Era",
    searches: "Search Spiral Era",
    accountEvents: "Account Changes Era",
  };

  return {
    eraName: eraNames[effectiveTop.key],
    caption: captions[effectiveTop.key],
    dominanceLine,
    topGroup: effectiveTop.key,
    topCount: effectiveTop.count,
  };
}

export function monthConfidence(month: string): "high" | "medium" {
  const sources = monthSources.get(month);
  if (!sources) return "medium";
  if (sources.has("export_files") || sources.has("dm_parser")) return "high";
  return "medium";
}

export function resolveMonthlyBreakdown(
  parsed: ParsedExportData,
  files?: Map<string, string>,
  searchWrapped?: SearchWrappedResult | null
): {
  groupMap: MonthlyGroupMap;
  mostActiveEra: MostActiveEraData | null;
} {
  const groupMap = buildMonthlyGroupMap(parsed, files, searchWrapped);

  const combinedForTotals = new Map<
    string,
    { month: string; label: string; count: number }
  >();
  for (const [month, groups] of groupMap) {
    const count = monthTotal(groups);
    if (count > 0) {
      combinedForTotals.set(month, {
        month,
        label: formatMonthLabel(month),
        count,
      });
    }
  }

  let mostActiveEra = parsed.mostActiveEra;

  if (combinedForTotals.size > 0) {
    const monthlyTotals = [...combinedForTotals.values()].sort((a, b) =>
      a.month.localeCompare(b.month)
    );
    const byCount = [...combinedForTotals.values()].sort(
      (a, b) => b.count - a.count
    );
    const peak = byCount[0];
    const peakGroups = groupMap.get(peak.month);
    const topRanked = peakGroups ? topGroupsForMonth(peakGroups, 2) : [];
    const inferred = peakGroups ? inferEraFromGroups(peakGroups) : null;

    mostActiveEra = {
      mostActiveMonth: peak.month,
      mostActiveMonthLabel: peak.label,
      mostActiveMonthCount: peak.count,
      topActivityType: topRanked[0]?.label,
      topActivityTypes: topRanked.map((r) => r.label),
      topActivityCaption: inferred?.dominanceLine,
      topMonths: byCount.slice(0, 3),
      monthlyTotals,
    };
  } else if (!mostActiveEra && files?.size) {
    mostActiveEra = computeMostActiveEra({
      files,
      messages: parsed.messages,
      network: parsed.network,
      ads: parsed.ads,
    });
  }

  return { groupMap, mostActiveEra };
}

export { GROUP_LABELS };
