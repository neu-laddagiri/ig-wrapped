import { formatMonthLabel } from "@/lib/formatters";
import type { MonthlyActivityByType } from "@/lib/activityTimelineParser";
import { parseActivityTimelineFromFiles } from "@/lib/activityTimelineParser";
import type {
  ActivityTypeKey,
  AdsPrivacyData,
  DmAnalytics,
  MostActiveEraData,
  MostActiveEraMonth,
  NetworkStats,
  ParsedExportData,
} from "@/types/instagram";
import type { ErasTimeline } from "@/types/insights";
import { formatMonthKey } from "@/lib/formatters";

const ACTIVITY_LABELS: Record<ActivityTypeKey, string> = {
  dms: "DMs",
  likedPosts: "liked posts",
  likedComments: "liked comments",
  postComments: "post comments",
  savedPosts: "saved posts",
  storiesViewed: "story views",
  storyLikes: "story likes",
  pollInteractions: "poll votes",
  emojiSliders: "emoji sliders",
  quizzes: "quizzes",
  videosWatched: "videos watched",
  postsViewed: "posts viewed",
  following: "follows",
  followers: "new followers",
  adsVideosWatched: "videos watched",
  adsPostsViewed: "posts viewed",
};

// posts_viewed / videos_watched under ads_information/ are organic impressions.
const ORGANIC_TYPE: Partial<Record<ActivityTypeKey, ActivityTypeKey>> = {
  adsVideosWatched: "videosWatched",
  adsPostsViewed: "postsViewed",
};

type CombinedMonthMap = Map<string, Map<ActivityTypeKey, number>>;

function createCombinedMap(): CombinedMonthMap {
  return new Map();
}

function mergeTypeMap(
  combined: CombinedMonthMap,
  type: ActivityTypeKey,
  monthMap: Map<string, number> | undefined
): void {
  if (!monthMap) return;
  for (const [month, count] of monthMap) {
    let types = combined.get(month);
    if (!types) {
      types = new Map();
      combined.set(month, types);
    }
    types.set(type, (types.get(type) ?? 0) + count);
  }
}

function mergeMonthlyByType(
  combined: CombinedMonthMap,
  source: MonthlyActivityByType
): void {
  for (const [type, monthMap] of source) {
    mergeTypeMap(combined, ORGANIC_TYPE[type] ?? type, monthMap);
  }
}

function addDmMonths(
  combined: CombinedMonthMap,
  messages: DmAnalytics | null
): void {
  if (!messages?.messagesByMonth?.length) return;
  const monthMap = new Map(
    messages.messagesByMonth.map(({ month, count }) => [month, count])
  );
  mergeTypeMap(combined, "dms", monthMap);
}

function addNetworkMonths(
  combined: CombinedMonthMap,
  network: NetworkStats | null
): void {
  if (!network) return;

  const followingMonths = new Map<string, number>();
  for (const account of network.following) {
    if (!account.timestamp) continue;
    const month = formatMonthKey(account.timestamp);
    followingMonths.set(month, (followingMonths.get(month) ?? 0) + 1);
  }
  mergeTypeMap(combined, "following", followingMonths);

  const followerMonths = new Map<string, number>();
  for (const account of network.followers) {
    if (!account.timestamp) continue;
    const month = formatMonthKey(account.timestamp);
    followerMonths.set(month, (followerMonths.get(month) ?? 0) + 1);
  }
  mergeTypeMap(combined, "followers", followerMonths);
}

function monthTotal(types: Map<ActivityTypeKey, number>): number {
  let total = 0;
  for (const count of types.values()) total += count;
  return total;
}

function topTypesForMonth(
  types: Map<ActivityTypeKey, number>,
  limit = 2
): ActivityTypeKey[] {
  return [...types.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([type]) => type);
}

function formatTopActivityLine(types: ActivityTypeKey[]): string | undefined {
  if (types.length === 0) return undefined;
  const labels = types.map((t) => ACTIVITY_LABELS[t]);
  if (labels.length === 1) return `Dominated by ${labels[0]}.`;
  return `Dominated by ${labels[0]} and ${labels[1]}.`;
}

function buildEraFromCombined(combined: CombinedMonthMap): MostActiveEraData | null {
  if (combined.size === 0) return null;

  const monthlyTotals: MostActiveEraMonth[] = [...combined.entries()]
    .map(([month, types]) => ({
      month,
      label: formatMonthLabel(month),
      count: monthTotal(types),
    }))
    .sort((a, b) => b.count - a.count || b.month.localeCompare(a.month));

  const peak = monthlyTotals[0];
  if (!peak || peak.count <= 0) return null;

  const peakTypes = combined.get(peak.month);
  const topTypeKeys = peakTypes ? topTypesForMonth(peakTypes) : [];
  const topActivityType = topTypeKeys[0]
    ? ACTIVITY_LABELS[topTypeKeys[0]]
    : undefined;

  return {
    mostActiveMonth: peak.month,
    mostActiveMonthLabel: peak.label,
    mostActiveMonthCount: peak.count,
    topActivityType,
    topActivityTypes: topTypeKeys.map((t) => ACTIVITY_LABELS[t]),
    topActivityCaption: formatTopActivityLine(topTypeKeys),
    topMonths: monthlyTotals.slice(0, 3),
    monthlyTotals: monthlyTotals.sort((a, b) => a.month.localeCompare(b.month)),
  };
}

export interface ComputeMostActiveEraInput {
  files?: Map<string, string>;
  messages: DmAnalytics | null;
  network: NetworkStats | null;
  ads?: AdsPrivacyData | null;
}

export function computeMostActiveEra(
  input: ComputeMostActiveEraInput
): MostActiveEraData | null {
  const combined = createCombinedMap();

  if (input.files?.size) {
    mergeMonthlyByType(combined, parseActivityTimelineFromFiles(input.files));
  }

  addDmMonths(combined, input.messages);
  addNetworkMonths(combined, input.network);

  return buildEraFromCombined(combined);
}

function eraFromTimeline(eras: ErasTimeline): MostActiveEraData | null {
  const peak = eras.peakMonth ?? eras.topMonths[0];
  if (!peak || !eras.monthlyTotals.length) return null;
  const peakLabel = eras.eraLabels.find((e) => e.month === peak.month);
  return {
    mostActiveMonth: peak.month,
    mostActiveMonthLabel: peak.label || formatMonthLabel(peak.month),
    mostActiveMonthCount: peak.count,
    topActivityType: peakLabel?.topActivityType,
    topActivityTypes: peakLabel?.breakdown?.slice(0, 2).map((b) => b.label),
    topActivityCaption: peakLabel?.dominanceLine,
    topMonths: eras.topMonths,
    monthlyTotals: eras.monthlyTotals,
  };
}

/**
 * Peak-month data for display. Prefers the insights eras timeline so every tab
 * shows the same month and count as the Eras tab; falls back to the stored era
 * or a recompute from snapshot fields (older saves).
 */
export function resolveMostActiveEra(
  parsed: ParsedExportData
): MostActiveEraData | null {
  const fromTimeline = parsed.insights?.eras
    ? eraFromTimeline(parsed.insights.eras)
    : null;
  if (fromTimeline) return fromTimeline;
  if (parsed.mostActiveEra) return parsed.mostActiveEra;

  const combined = createCombinedMap();
  addDmMonths(combined, parsed.messages);
  addNetworkMonths(combined, parsed.network);
  return buildEraFromCombined(combined);
}

export function getMostActiveEraCaption(): string {
  return "Your peak Instagram era. The app was basically your second home this month.";
}

export { ACTIVITY_LABELS };
