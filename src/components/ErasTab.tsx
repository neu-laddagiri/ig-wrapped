"use client";

import { Calendar, TrendingUp, AlertCircle } from "lucide-react";
import type { InsightsBundle } from "@/types/insights";
import { MostActiveEraCard, MostActiveMonthsChart } from "@/components/MostActiveEraCard";
import type { MostActiveEraData } from "@/types/instagram";
import { erasNeedRefresh } from "@/lib/activityTimeline";
import { ConfidencePill } from "@/components/ConfidencePill";
import { formatNumber } from "@/lib/formatters";

interface ErasTabProps {
  insights: InsightsBundle | null;
  mostActiveEra: MostActiveEraData | null;
}

export function ErasTab({ insights, mostActiveEra }: ErasTabProps) {
  const eras = insights?.eras;
  const needsRefresh = erasNeedRefresh(eras);

  if (!eras && !mostActiveEra) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
        <Calendar className="mx-auto h-10 w-10 text-white/20" />
        <p className="mx-auto mt-4 max-w-md text-sm text-white/45">
          Not enough timestamped activity found. Re-export with All time and JSON
          format.
        </p>
      </div>
    );
  }

  const chartEra: MostActiveEraData | null =
    mostActiveEra ??
    (eras
      ? {
          mostActiveMonth: eras.peakMonth?.month ?? "",
          mostActiveMonthLabel: eras.peakMonth?.label ?? "",
          mostActiveMonthCount: eras.peakMonth?.count ?? 0,
          topMonths: eras.topMonths,
          monthlyTotals: eras.monthlyTotals,
        }
      : null);

  return (
    <div className="space-y-6">
      {needsRefresh && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-sm text-amber-100/90">
            Re-upload and save again to refresh corrected era labels.
          </p>
        </div>
      )}

      {chartEra && <MostActiveEraCard era={chartEra} compact />}

      {eras && eras.eraLabels.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eras.eraLabels.map((era) => (
            <div
              key={era.month}
              className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#DD2A7B]/80">
                  {era.label}
                </p>
                {era.confidence && (
                  <ConfidencePill level={era.confidence} />
                )}
              </div>
              <p className="mt-2 text-lg font-bold text-white">
                {era.monthLabel ?? era.month}
              </p>
              <p className="mt-0.5 text-sm text-white/50">
                {formatNumber(era.count)} tracked actions
              </p>
              {era.topActivityType && (
                <p className="mt-2 text-xs text-white/55">
                  Top activity: {era.topActivityType}
                  {era.topActivityCount != null &&
                    ` · ${formatNumber(era.topActivityCount)}`}
                </p>
              )}
              {era.dominanceLine && (
                <p className="mt-1 text-xs italic text-white/40">
                  {era.dominanceLine}
                </p>
              )}
              <p className="mt-2 text-xs leading-relaxed text-white/45">
                {era.caption}
              </p>
              {era.breakdown && era.breakdown.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-white/8 pt-3">
                  {era.breakdown.map((line) => (
                    <li
                      key={line.label}
                      className="flex justify-between text-[11px] text-white/45"
                    >
                      <span>{line.label}</span>
                      <span className="tabular-nums text-white/60">
                        {formatNumber(line.count)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {chartEra && chartEra.topMonths.length > 1 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <MostActiveMonthsChart era={chartEra} />
        </div>
      )}

      {eras?.trend && eras.trend !== "unknown" && (
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/55">
          <TrendingUp className="h-4 w-4 text-[#515BD4]" />
          Activity trend:{" "}
          <span className="font-medium capitalize text-white">{eras.trend}</span>
        </div>
      )}
    </div>
  );
}
