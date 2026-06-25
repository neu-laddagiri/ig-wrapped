import { formatMonthLabel } from "@/lib/formatters";
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

export const ERAS_TIMELINE_VERSION = 2;

function buildEraLabelForMonth(
  month: string,
  count: number,
  groups: Map<import("@/lib/monthlyActivityBreakdown").EraGroupKey, number>
): EraLabel {
  const inferred = inferEraFromGroups(groups);
  const topRanked = topGroupsForMonth(groups, 3);
  const topDisplay = topRanked[0];

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

  const eraLabels: EraLabel[] = topMonths.map((m) => {
    const groups = groupMap.get(m.month) ?? new Map();
    const total = monthTotal(groups) || m.count;
    return buildEraLabelForMonth(m.month, total, groups);
  });

  const monthlyTotals = era.monthlyTotals;

  let trend: ErasTimeline["trend"] = "unknown";
  if (monthlyTotals.length >= 3) {
    const recent = monthlyTotals.slice(-3).map((m) => m.count);
    const older = monthlyTotals.slice(-6, -3).map((m) => m.count);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg =
      older.length > 0
        ? older.reduce((a, b) => a + b, 0) / older.length
        : recentAvg;
    if (recentAvg > olderAvg * 1.15) trend = "rising";
    else if (recentAvg < olderAvg * 0.85) trend = "falling";
    else trend = "stable";
  }

  return {
    version: ERAS_TIMELINE_VERSION,
    monthlyTotals,
    topMonths,
    peakMonth: topMonths[0],
    eraLabels,
    trend,
  };
}

/** True when saved insights lack per-month era breakdown (pre-fix saves). */
export function erasNeedRefresh(eras: ErasTimeline | null | undefined): boolean {
  if (!eras) return false;
  if ((eras.version ?? 0) < ERAS_TIMELINE_VERSION) return true;
  const first = eras.eraLabels[0];
  return Boolean(first && !first.breakdown?.length && !first.monthLabel);
}
