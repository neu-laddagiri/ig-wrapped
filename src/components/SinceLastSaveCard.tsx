"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, TrendingUp } from "lucide-react";
import type { ParsedExportData } from "@/types/instagram";
import { compareParsedExports } from "@/lib/accountInsights";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured, loadSavedAnalyses, loadSavedAnalysisById } from "@/lib/cloudSave";

interface SinceLastSaveCardProps {
  current: ParsedExportData;
  currentSavedId: string | null;
}

export function SinceLastSaveCard({
  current,
  currentSavedId,
}: SinceLastSaveCardProps) {
  const { user } = useAuth();
  const userId = user?.id;
  const requestKey =
    userId && currentSavedId && isSupabaseConfigured()
      ? `${userId}:${currentSavedId}`
      : null;
  // Tagged with the request it answers, so a change of account/save never shows a stale result.
  const [previous, setPrevious] = useState<{
    key: string;
    data: ParsedExportData | null;
    label: string;
  } | null>(null);

  useEffect(() => {
    if (!requestKey) return;
    let cancelled = false;
    const settle = (data: ParsedExportData | null, label = "") => {
      if (!cancelled) setPrevious({ key: requestKey, data, label });
    };
    void (async () => {
      const { data: summaries } = await loadSavedAnalyses();
      const currentSummary = summaries.find((s) => s.id === currentSavedId);
      const others = summaries.filter((s) => s.id !== currentSavedId);
      // Prefer the newest save that is older than the current one.
      const prevSummary =
        others.find(
          (s) => !currentSummary || s.updatedAt <= currentSummary.updatedAt
        ) ?? others[0];
      if (!prevSummary) return settle(null);
      const { data: row } = await loadSavedAnalysisById(prevSummary.id);
      const snap = row?.full_analysis_json?.parsed;
      if (!snap) return settle(null);
      settle(
        {
          ...snap,
          filePaths: [],
          mostActiveEra: snap.mostActiveEra ?? null,
          insights: snap.insights ?? null,
        },
        prevSummary.title ?? prevSummary.exportName ?? "Previous save"
      );
    })().catch(() => settle(null));
    return () => {
      cancelled = true;
    };
  }, [requestKey, currentSavedId]);

  const before = previous?.key === requestKey ? previous.data : null;
  const beforeLabel = previous?.key === requestKey ? previous.label : "";
  const comparison = useMemo(() => {
    if (!before) return null;
    return compareParsedExports(before, current, beforeLabel, "Current");
  }, [before, current, beforeLabel]);

  if (!currentSavedId) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-white/30" />
          <h3 className="font-semibold text-white">Since your last save</h3>
        </div>
        <p className="mt-2 text-sm text-white/45">
          Save analyses over time to track changes between exports.
        </p>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-white/30" />
          <h3 className="font-semibold text-white">Since your last save</h3>
        </div>
        <p className="mt-2 text-sm text-white/45">
          No earlier saved analysis found. Save again after your next export to
          unlock change tracking.
        </p>
      </div>
    );
  }

  const highlights = comparison.summary.filter(
    (s) => s.delta != null && s.delta !== 0
  );

  return (
    <div className="rounded-2xl animated-gradient-border bg-white/[0.04] p-5">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-[#DD2A7B]" />
        <h3 className="font-semibold text-white">Since your last save</h3>
      </div>
      <p className="mt-1 text-xs text-white/40">
        vs {beforeLabel} — based on available export data.
      </p>
      {highlights.length === 0 ? (
        <p className="mt-3 text-sm text-white/50">No major metric shifts detected.</p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {highlights.slice(0, 6).map((row) => (
            <li
              key={row.label}
              className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-sm"
            >
              <span className="text-white/45">{row.label}: </span>
              <span className="font-medium text-white">{row.after}</span>
              {row.delta != null && (
                <span
                  className={`ml-1 text-xs ${
                    row.delta > 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  ({row.delta > 0 ? "+" : ""}
                  {row.delta})
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
