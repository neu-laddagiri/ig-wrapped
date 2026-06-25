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
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/45">
        Not enough timestamped DM messages for a heatmap. Re-upload an export
        with message timestamps.
      </div>
    );
  }

  const max = Math.max(...heatmap.cells.map((c) => c.count), 1);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h4 className="font-semibold text-white">DM activity heatmap</h4>
      <p className="mt-1 text-xs text-white/40">
        Day × hour from export timestamps. {heatmap.totalTimestamped} messages
        mapped.
      </p>
      <div className="mt-4 grid grid-cols-[2rem_repeat(24,minmax(0,1fr))] gap-0.5 text-[9px]">
        <div />
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className="text-center text-white/25">
            {h % 6 === 0 ? h : ""}
          </div>
        ))}
        {DAY_LABELS.map((day, dayIdx) => (
          <Fragment key={day}>
            <div className="text-white/35">{day}</div>
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
                        ? "rgba(255,255,255,0.04)"
                        : `rgba(221, 42, 123, ${0.15 + intensity * 0.75})`,
                  }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-white/50">
        <span>Peak day: {heatmap.mostActiveDay}</span>
        <span>Peak hour: {heatmap.mostActiveHour}</span>
        <span>Late-night msgs: {heatmap.lateNightStreak}</span>
        <span>Longest gap: {heatmap.longestDroughtDays}d</span>
      </div>
    </div>
  );
}
