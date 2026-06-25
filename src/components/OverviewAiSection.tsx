"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import type { OverviewAiSummaryResult, OverviewAiTone } from "@/types/overviewAiSummary";
import type { ParsedExportData } from "@/types/instagram";
import type { LinkedInHelperEntry } from "@/types/instagram";
import { buildOverviewMetrics } from "@/lib/overviewMetrics";

const TONES: { id: OverviewAiTone; label: string }[] = [
  { id: "wrapped", label: "Wrapped" },
  { id: "real", label: "Real" },
  { id: "savage", label: "Savage" },
  { id: "drama", label: "Drama" },
];

interface OverviewAiSectionProps {
  parsed: ParsedExportData;
  linkedinProgress: LinkedInHelperEntry[];
  summary: OverviewAiSummaryResult | null;
  onSummaryChange: (summary: OverviewAiSummaryResult | null) => void;
}

export function OverviewAiSection({
  parsed,
  linkedinProgress,
  summary,
  onSummaryChange,
}: OverviewAiSectionProps) {
  const [tone, setTone] = useState<OverviewAiTone>("wrapped");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/overview-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tone,
          metrics: buildOverviewMetrics(parsed, linkedinProgress),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not generate recap.");
        return;
      }
      onSummaryChange(data.summary);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#DD2A7B]" />
            <h3 className="font-semibold text-white">AI Overall Recap</h3>
          </div>
          <p className="mt-1 text-xs text-white/40">
            Optional. Uses aggregated metrics only — no raw DMs or search history.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTone(t.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                tone === t.id
                  ? "animated-gradient-bg text-white"
                  : "border border-white/10 text-white/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={generate}
        disabled={loading}
          className="mt-4 inline-flex items-center gap-2 rounded-full animated-gradient-bg px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Generate Overall Recap
      </button>

      {error && <p className="mt-3 text-sm text-red-300/90">{error}</p>}

      {summary && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <RecapCard title="Overall vibe" text={summary.overallVibe} />
          <RecapCard title="What your Instagram says" text={summary.whatInstagramSays} />
          <RecapCard title="Strongest pattern" text={summary.strongestPattern} />
          <RecapCard title="Funniest callout" text={summary.funniestCallout} />
          <RecapCard title="Privacy / social tip" text={summary.privacyRecommendation} />
          <RecapCard title="Wrapped award" text={summary.wrappedAward} accent />
        </div>
      )}
    </div>
  );
}

function RecapCard({
  title,
  text,
  accent,
}: {
  title: string;
  text: string;
  accent?: boolean;
}) {
  if (!text) return null;
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent
          ? "animated-gradient-border bg-gradient-to-br from-[#F58529]/10 to-[#515BD4]/10"
          : "border-white/10 bg-white/[0.03]"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
        {title}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-white/80">{text}</p>
    </div>
  );
}
