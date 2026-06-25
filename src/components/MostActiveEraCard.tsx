"use client";

import { Calendar } from "lucide-react";
import type { MostActiveEraData } from "@/types/instagram";
import { formatNumber } from "@/lib/formatters";
import { getMostActiveEraCaption } from "@/lib/mostActiveEra";

interface MostActiveEraSectionProps {
  era: MostActiveEraData | null;
  compact?: boolean;
}

function TopMonthsChart({ era }: { era: MostActiveEraData }) {
  const max = era.topMonths[0]?.count ?? 1;

  return (
    <div className="mt-4 space-y-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
        Top 3 active months
      </p>
      {era.topMonths.map((entry) => (
        <div key={entry.month}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="text-white/70">{entry.label}</span>
            <span className="tabular-nums text-white/45">
              {formatNumber(entry.count)}
            </span>
          </div>
          <div className="h-1.5 animated-gradient-progress">
            <div
              className="h-full animated-gradient-bar"
              style={{ width: `${Math.max(8, (entry.count / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MostActiveEraCard({ era, compact = false }: MostActiveEraSectionProps) {
  if (!era) {
    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">
              Most active era
            </p>
            <p className="mt-2 text-lg font-semibold text-white/70">
              Not enough timestamped activity found
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/40">
              We need dated activity from your export to calculate your peak
              month.
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#F58529]/20 via-[#DD2A7B]/15 to-[#515BD4]/20">
            <Calendar className="h-5 w-5 text-[#DD2A7B]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-white/40">
            Most active era
          </p>
          <p className="mt-2 text-2xl font-bold text-white">
            {era.mostActiveMonthLabel}
          </p>
          <p className="mt-1 text-sm text-[#DD2A7B]/90">
            {formatNumber(era.mostActiveMonthCount)} tracked actions
          </p>
          <p className="mt-2 text-xs leading-relaxed text-white/45">
            {getMostActiveEraCaption()}
          </p>
          {era.topActivityCaption && (
            <p className="mt-1.5 text-xs text-white/55">{era.topActivityCaption}</p>
          )}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#F58529]/20 via-[#DD2A7B]/15 to-[#515BD4]/20">
          <Calendar className="h-5 w-5 text-[#DD2A7B]" />
        </div>
      </div>
      {!compact && era.topMonths.length > 1 && <TopMonthsChart era={era} />}
    </div>
  );
}

export function MostActiveMonthsChart({ era }: { era: MostActiveEraData }) {
  return <TopMonthsChart era={era} />;
}
