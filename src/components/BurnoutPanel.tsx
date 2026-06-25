"use client";

import type { BurnoutMeterResult } from "@/types/insights";
import { ConfidencePill } from "@/components/ConfidencePill";
import { ExplainTooltip } from "@/components/ExplainTooltip";

interface BurnoutPanelProps {
  burnout: BurnoutMeterResult;
}

export function BurnoutPanel({ burnout }: BurnoutPanelProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-white">Burnout / Usage Meter</h3>
          <p className="mt-1 text-xs text-white/40">{burnout.disclaimer}</p>
        </div>
        <ConfidencePill level={burnout.confidence} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Touch Grass Score" value={`${burnout.touchGrassScore}/100`} />
        <Metric label="Night owl score" value={`${burnout.nightOwlScore}%`} />
        <Metric
          label="Social battery drain"
          value={`${burnout.socialBatteryDrain}/100`}
        />
        <Metric
          label="Passive scrolling"
          value={`${burnout.passiveScrollingRatio}%`}
        />
        {burnout.mostActiveHour != null && (
          <Metric label="Most active hour" value={`${burnout.mostActiveHour}:00`} />
        )}
        {burnout.mostActiveDay && (
          <Metric label="Most active day" value={burnout.mostActiveDay} />
        )}
        {burnout.peakDoomscrollMonth && (
          <Metric label="Peak month" value={burnout.peakDoomscrollMonth} />
        )}
        <Metric label="Weekend vs weekday" value={burnout.weekendVsWeekday} />
      </div>
      <div className="mt-3">
        <ExplainTooltip
          title="Usage estimates"
          summary="Derived from DM timestamps and activity export totals."
          confidence={burnout.confidence}
          lines={burnout.metrics.map((m) => ({ label: m.label, value: m.value }))}
        />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-white/35">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
