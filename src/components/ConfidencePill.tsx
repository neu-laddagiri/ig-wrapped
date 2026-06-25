"use client";

import type { ConfidenceLevel } from "@/types/insights";

const STYLES: Record<ConfidenceLevel, string> = {
  high: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200/90",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-200/90",
  low: "border-white/15 bg-white/5 text-white/50",
};

const TOOLTIPS: Record<ConfidenceLevel, string> = {
  high: "Calculated directly from export files with clear data.",
  medium: "Estimated from several export categories.",
  low: "Inferred from limited or ambiguous export data.",
};

interface ConfidencePillProps {
  level: ConfidenceLevel;
  className?: string;
}

export function ConfidencePill({ level, className = "" }: ConfidencePillProps) {
  const label =
    level === "high"
      ? "High confidence"
      : level === "medium"
        ? "Medium confidence"
        : "Low confidence";

  return (
    <span
      title={TOOLTIPS[level]}
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STYLES[level]} ${className}`}
    >
      {label}
    </span>
  );
}
