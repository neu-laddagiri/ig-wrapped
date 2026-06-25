"use client";

import { Calendar, TrendingUp } from "lucide-react";
import type { InsightsBundle } from "@/types/insights";
import { MostActiveEraCard, MostActiveMonthsChart } from "@/components/MostActiveEraCard";
import type { MostActiveEraData } from "@/types/instagram";

interface ErasTabProps {
  insights: InsightsBundle | null;
  mostActiveEra: MostActiveEraData | null;
}

export function ErasTab({ insights, mostActiveEra }: ErasTabProps) {
  const eras = insights?.eras;

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

  return (
    <div className="space-y-6">
      {mostActiveEra && <MostActiveEraCard era={mostActiveEra} />}

      {eras && eras.eraLabels.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {eras.eraLabels.map((era) => (
            <div
              key={era.month}
              className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5"
            >
              <p className="text-xs uppercase tracking-wider text-[#DD2A7B]/80">
                {era.label}
              </p>
              <p className="mt-2 text-lg font-bold text-white">
                {era.count.toLocaleString()} actions
              </p>
              <p className="mt-2 text-xs text-white/45">{era.caption}</p>
            </div>
          ))}
        </div>
      )}

      {eras && eras.topMonths.length > 1 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <MostActiveMonthsChart
            era={{
              mostActiveMonth: eras.peakMonth?.month ?? "",
              mostActiveMonthLabel: eras.peakMonth?.label ?? "",
              mostActiveMonthCount: eras.peakMonth?.count ?? 0,
              topMonths: eras.topMonths,
              monthlyTotals: eras.monthlyTotals,
            }}
          />
        </div>
      )}

      {eras?.trend && eras.trend !== "unknown" && (
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/55">
          <TrendingUp className="h-4 w-4 text-[#515BD4]" />
          Activity trend:{" "}
          <span className="font-medium text-white capitalize">{eras.trend}</span>
        </div>
      )}
    </div>
  );
}
