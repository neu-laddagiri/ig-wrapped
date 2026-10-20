import { formatMonthKey, formatMonthLabel } from "@/lib/formatters";
import type { ParsedExportData, MostActiveEraData } from "@/types/instagram";
import type { EraLabel, ErasTimeline } from "@/types/insights";
import type { SearchWrappedResult } from "@/types/insights";
import {
  inferEraFromGroups,
  monthConfidence,
  monthTotal,
  resolveMonthlyBreakdown,
  topGroupsForMonth,
} from "@/lib/monthlyActivityBreakdown";

export const ERAS_TIMELINE_VERSION = 3;

function buildEraLabelForMonth(
  month: string,
  count: number,
  groups: Map<import("@/lib/monthlyActivityBreakdown").EraGroupKey, number>
): EraLabel {
  const topRanked = topGroupsForMonth(groups, 3);
  const topDisplay = topRanked[0];
  // A saved analysis without its ZIP can know a month's total but not its mix.
  const inferred =
    monthTotal(groups) === 0 && count > 0
      ? {
          eraName: "Peak Activity Era",
          caption: "Lots of tracked activity — re-upload your export to see the breakdown.",
          dominanceLine: undefined,
        }
      : inferEraFromGroups(groups);

  return {
    month,
    monthLabel: formatMonthLabel(month),
    label: inferred.eraName,
    caption: inferred.caption,
    dominanceLine: inferred.dominanceLine,
    count,
    topActivityType: topDisplay?.label ?? "Mixed activity",
    topActivityCount: topDisplay?.count ?? 0,
    breakdown: topRanked.map((r) => ({ label: r.label, count: r.count })),
    confidence: monthConfidence(month),
  };
}

export function buildErasTimeline(
  parsed: ParsedExportData,
  mostActiveEra: MostActiveEraData | null,
  files?: Map<string, string>,
  searchWrapped?: SearchWrappedResult | null
): ErasTimeline | null {
  const { groupMap, mostActiveEra: resolvedEra } = resolveMonthlyBreakdown(
    parsed,
    files,
    searchWrapped
  );

  const era = resolvedEra ?? mostActiveEra;
  if (!era?.monthlyTotals.length) return null;

  const topMonths = era.topMonths.length
    ? era.topMonths
    : [...era.monthlyTotals].sort((a, b) => b.count - a.count).slice(0, 3);

  // Counts come from the same totals as the chart so the screen shows one number.
  const eraLabels: EraLabel[] = topMonths.map((m) =>
    buildEraLabelForMonth(m.month, m.count, groupMap.get(m.month) ?? new Map())
  );

  const monthlyTotals = era.monthlyTotals;

  return {
    version: ERAS_TIMELINE_VERSION,
    monthlyTotals,
    topMonths,
    peakMonth: topMonths[0],
    eraLabels,
    trend: computeTrend(monthlyTotals),
  };
}

function shiftMonthKey(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  const year = Math.floor(index / 12);
  return `${year}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/**
 * Last 3 complete calendar months vs the 3 before, with empty months as 0.
 * The current month is still in progress, so it is left out.
 */
function computeTrend(
  monthlyTotals: { month: string; count: number }[]
): ErasTimeline["trend"] {
  const currentMonth = formatMonthKey(Math.floor(Date.now() / 1000));
  const complete = monthlyTotals.filter(
    (m) => /^\d{4}-\d{2}$/.test(m.month) && m.month < currentMonth
  );
  if (complete.length < 3) return "unknown";

  const counts = new Map(complete.map((m) => [m.month, m.count]));
  const last = complete[complete.length - 1].month;
  const window = Array.from({ length: 6 }, (_, i) => shiftMonthKey(last, i - 5));
  const avg = (keys: string[]) =>
    keys.reduce((sum, k) => sum + (counts.get(k) ?? 0), 0) / keys.length;
  const olderAvg = avg(window.slice(0, 3));
  const recentAvg = avg(window.slice(3));

  if (recentAvg > olderAvg * 1.15) return "rising";
  if (recentAvg < olderAvg * 0.85) return "falling";
  return "stable";
}

/** True when saved insights lack per-month era breakdown (pre-fix saves). */
export function erasNeedRefresh(eras: ErasTimeline | null | undefined): boolean {
  if (!eras) return false;
  if ((eras.version ?? 0) < ERAS_TIMELINE_VERSION) return true;
  const first = eras.eraLabels[0];
  return Boolean(first && !first.breakdown?.length && !first.monthLabel);
}
