"use client";

import { Fragment } from "react";
import type { DmHeatmapResult } from "@/types/insights";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface DmHeatmapSectionProps {
  heatmap: DmHeatmapResult | null | undefined;
}

export function DmHeatmapSection({ heatmap }: DmHeatmapSectionProps) {
  if (!heatmap?.available) {
    return (
      <div className="rounded-lg border border-ig-border bg-ig-subtle p-4 text-sm text-ig-muted">
        Not enough timestamped DM messages for a heatmap. Re-upload an export
        with message timestamps.
      </div>
    );
  }

  const max = Math.max(...heatmap.cells.map((c) => c.count), 1);

  return (
    <div className="rounded-xl border border-ig-border p-4">
      <h4 className="font-semibold text-fg">When you message</h4>
      <p className="mt-1 text-xs text-ig-muted">
        Day × hour from export timestamps. {heatmap.totalTimestamped} messages
        mapped.
      </p>
      <div className="mt-4 grid grid-cols-[2rem_repeat(24,minmax(0,1fr))] gap-0.5 text-[9px]">
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-center text-ig-muted">
            {h % 6 === 0 ? h : ""}
          </div>
        ))}
        {DAY_LABELS.map((day, dayIdx) => (
          <Fragment key={day}>
            <div className="text-ig-muted">{day}</div>
            {Array.from({ length: 24 }, (_, hour) => {
              const cell = heatmap.cells.find(
                (c) => c.day === dayIdx && c.hour === hour
              );
              const count = cell?.count ?? 0;
              const intensity = count / max;
              return (
                <div
                  key={`${day}-${hour}`}
                  title={`${day} ${hour}:00 — ${count} msgs`}
                  className="aspect-square rounded-sm"
                  style={{
                    background:
                      count === 0
                        ? "var(--ig-secondary-bg)"
                        : `rgba(255, 0, 105, ${0.18 + intensity * 0.77})`,
                  }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-ig-muted">
        <span>Peak day: {heatmap.mostActiveDay}</span>
        <span>Peak hour: {heatmap.mostActiveHour}</span>
        <span>Late-night msgs: {heatmap.lateNightStreak}</span>
        <span>Longest gap: {heatmap.longestDroughtDays}d</span>
      </div>
    </div>
  );
}
