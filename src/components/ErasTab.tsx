"use client";

import { useMemo } from "react";
import { Calendar, TrendingUp, AlertCircle, Sparkles } from "lucide-react";
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

const ERA_GRADIENTS = [
  "from-[#F58529]/25 via-[#DD2A7B]/20 to-[#515BD4]/25",
  "from-[#515BD4]/20 via-[#DD2A7B]/15 to-[#F58529]/20",
  "from-[#DD2A7B]/20 via-[#515BD4]/15 to-[#F58529]/15",
];

export function ErasTab({ insights, mostActiveEra }: ErasTabProps) {
  const eras = insights?.eras;
  const needsRefresh = erasNeedRefresh(eras);

  const heroEra = eras?.eraLabels[0];
  const topEras = eras?.eraLabels.slice(0, 3) ?? [];

  const maxEraCount = useMemo(
    () => Math.max(...(eras?.eraLabels.map((e) => e.count) ?? [1]), 1),
    [eras]
  );

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

      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#F58529]/15 via-[#DD2A7B]/12 to-[#515BD4]/15 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#DD2A7B]/20 blur-3xl" />
        <div className="relative flex items-start gap-3">
          <Sparkles className="mt-1 h-6 w-6 text-[#DD2A7B]" />
          <div>
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Your IG Eras
            </h2>
            <p className="mt-2 max-w-xl text-sm text-white/55">
              Peak months from your export — labeled by what actually dominated
              (DMs, likes, stories, follows), not generic security noise.
            </p>
          </div>
        </div>

        {heroEra && (
          <div className="relative mt-6 rounded-2xl border border-white/15 bg-black/20 p-5 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#F58529]/90">
              Top era
            </p>
            <p className="mt-2 text-xl font-bold text-white sm:text-2xl">
              {heroEra.label}
            </p>
            <p className="mt-1 text-sm text-white/60">
              {heroEra.monthLabel ?? heroEra.month} ·{" "}
              {formatNumber(heroEra.count)} tracked actions
            </p>
            {heroEra.dominanceLine && (
              <p className="mt-2 text-sm text-white/50">{heroEra.dominanceLine}</p>
            )}
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#515BD4] transition-all duration-700"
                style={{
                  width: `${Math.min(100, (heroEra.count / maxEraCount) * 100)}%`,
                }}
              />
            </div>
            {heroEra.breakdown && heroEra.breakdown.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {heroEra.breakdown.map((line) => (
                  <li
                    key={line.label}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/55"
                  >
                    {line.label}: {formatNumber(line.count)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {chartEra && <MostActiveEraCard era={chartEra} compact />}

      {topEras.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topEras.map((era, index) => (
            <div
              key={era.month}
              className={`rounded-2xl border border-white/10 bg-gradient-to-br ${ERA_GRADIENTS[index % ERA_GRADIENTS.length]} p-5`}
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
                  Top signal: {era.topActivityType}
                  {era.topActivityCount != null &&
                    ` · ${formatNumber(era.topActivityCount)}`}
                </p>
              )}
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#515BD4]"
                  style={{
                    width: `${Math.min(100, (era.count / maxEraCount) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-white/45">
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
