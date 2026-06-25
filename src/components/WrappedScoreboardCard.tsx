"use client";

import type { WrappedScoreboard } from "@/types/insights";
import { ConfidencePill } from "@/components/ConfidencePill";

interface WrappedScoreboardCardProps {
  scoreboard: WrappedScoreboard | null | undefined;
}

export function WrappedScoreboardCard({ scoreboard }: WrappedScoreboardCardProps) {
  if (!scoreboard) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">IG Health Scoreboard</h3>
          <p className="mt-1 text-sm text-white/45">{scoreboard.verdict}</p>
        </div>
        <p className="text-4xl font-bold text-white">
          {scoreboard.overallHealth}
          <span className="text-lg text-white/35">/100</span>
        </p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {scoreboard.entries.map((entry) => (
          <div
            key={entry.id}
            className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-white/50">{entry.label}</p>
              <ConfidencePill level={entry.confidence} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 animated-gradient-progress">
                <div
                  className="h-full animated-gradient-bar"
                  style={{
                    width: `${Math.max(4, (entry.score / entry.maxScore) * 100)}%`,
                  }}
                />
              </div>
              <span className="text-sm font-semibold tabular-nums text-white">
                {entry.score}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
