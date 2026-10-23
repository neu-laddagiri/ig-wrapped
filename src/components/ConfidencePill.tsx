"use client";

import type { ConfidenceLevel } from "@/types/insights";

const DOTS: Record<ConfidenceLevel, string> = {
  high: "bg-ig-good",
  medium: "bg-ig-warn",
  low: "bg-ig-border-strong",
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

/** A quiet dot-and-label note on how sure an estimate is. */
export function ConfidencePill({ level, className = "" }: ConfidencePillProps) {
  const label =
    level === "high"
      ? "High confidence"
      : level === "medium"
        ? "Estimated"
        : "Rough guess";

  return (
    <span
      title={TOOLTIPS[level]}
      className={`inline-flex items-center gap-1.5 text-xs font-normal text-ig-muted ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOTS[level]}`} aria-hidden />
      {label}
    </span>
  );
}
