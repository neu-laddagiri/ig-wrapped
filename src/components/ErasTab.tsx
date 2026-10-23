"use client";

import { useMemo } from "react";
import { AlertCircle, Calendar } from "lucide-react";
import type { InsightsBundle } from "@/types/insights";
import type { MostActiveEraData } from "@/types/instagram";
import { erasNeedRefresh } from "@/lib/activityTimeline";
import { ConfidencePill } from "@/components/ConfidencePill";
import { CANVAS_TONES, type CanvasTone } from "@/components/feed/Canvas";
import { formatNumber } from "@/lib/formatters";

interface ErasTabProps {
  insights: InsightsBundle | null;
  mostActiveEra: MostActiveEraData | null;
}

const ROW_TONES: CanvasTone[] = ["pink", "purple", "orange", "magenta", "yellow", "ink"];

/** Your eras: the peak month as a big card, then every labeled month as a list. */
export function ErasTab({ insights, mostActiveEra }: ErasTabProps) {
  const eras = insights?.eras;
  const needsRefresh = erasNeedRefresh(eras);
  const hero = eras?.eraLabels[0];

  const months = useMemo(
    () => [...(eras?.eraLabels ?? [])].sort((a, b) => b.month.localeCompare(a.month)),
    [eras]
  );
  const maxCount = Math.max(1, ...months.map((m) => m.count));
  const totals = (eras?.monthlyTotals ?? mostActiveEra?.monthlyTotals ?? []).slice(-12);
  const totalsMax = Math.max(1, ...totals.map((m) => m.count));
  const peakMonth = eras?.peakMonth?.month ?? mostActiveEra?.mostActiveMonth;

  if (!eras && !mostActiveEra) {
    return (
      <div className="py-16 text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-fg">
          <Calendar className="h-9 w-9" strokeWidth={1.5} />
        </span>
        <p className="mt-4 text-xl">Not enough dated activity</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ig-muted">
          Re-export with Date range: All time and Format: JSON.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[614px]">
      {needsRefresh && (
        <p className="mb-4 flex items-start gap-2 rounded-lg border border-ig-border px-3 py-2.5 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-ig-warn" />
          Re-upload your ZIP to refresh the era labels.
        </p>
      )}

      <section className="@container relative overflow-hidden rounded-xl" style={CANVAS_TONES.orange}>
        <div className="p-[7cqw]">
          <p className="text-[3.4cqw] font-semibold uppercase tracking-[0.18em] opacity-85">Your peak era</p>
          <p className="mt-[4cqw] text-[6cqw] font-semibold">{hero?.label ?? "Most active month"}</p>
          <p className="text-[11cqw] font-bold leading-none tracking-tight">
            {hero?.monthLabel ?? mostActiveEra?.mostActiveMonthLabel}
          </p>
          <p className="mt-[2cqw] text-[4.2cqw] opacity-90">
            {formatNumber(hero?.count ?? mostActiveEra?.mostActiveMonthCount ?? 0)} things you did that month
            {hero?.dominanceLine ? ` · ${hero.dominanceLine}` : ""}
          </p>
          {totals.length > 1 && (
            <div className="mt-[6cqw] flex h-[22cqw] items-end gap-[1.2cqw]" aria-hidden>
              {totals.map((m) => (
                <span
                  key={m.month}
                  className="flex-1 rounded-t-[1cqw] bg-white"
                  style={{ height: `${Math.max(6, (m.count / totalsMax) * 100)}%`, opacity: m.month === peakMonth ? 1 : 0.45 }}
                />
              ))}
            </div>
          )}
          {hero?.breakdown && hero.breakdown.length > 0 && (
            <ul className="mt-[5cqw] flex flex-wrap gap-[2cqw] text-[3.6cqw] font-semibold">
              {hero.breakdown.map((line) => (
                <li key={line.label} className="rounded-full bg-white/25 px-[3cqw] py-[1cqw]">
                  {line.label} {formatNumber(line.count)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {months.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-base font-semibold">Month by month</h2>
          <ul className="divide-y divide-ig-border">
            {months.map((era, i) => {
              const [month, year] = (era.monthLabel ?? era.month).split(" ");
              return (
                <li key={era.month} className="flex items-center gap-3 py-3">
                  <span
                    className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full leading-none"
                    style={CANVAS_TONES[ROW_TONES[i % ROW_TONES.length]]}
                    aria-hidden
                  >
                    <span className="text-xs font-bold">{month?.slice(0, 3)}</span>
                    {year && <span className="mt-0.5 text-[9px] font-semibold opacity-80">{year}</span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold">{era.label}</p>
                      {era.confidence && <ConfidencePill level={era.confidence} />}
                    </div>
                    <p className="truncate text-xs text-ig-muted">
                      {formatNumber(era.count)} actions
                      {era.topActivityType ? ` · mostly ${era.topActivityType.toLowerCase()}` : ""}
                    </p>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-ig-secondary">
                      <div className="h-full rounded-full bg-ig-gradient" style={{ width: `${(era.count / maxCount) * 100}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {eras?.trend && eras.trend !== "unknown" && (
        <p className="mt-6 text-sm text-ig-muted">
          Lately your activity is <span className="font-semibold text-fg">{eras.trend}</span>.
        </p>
      )}
    </div>
  );
}
