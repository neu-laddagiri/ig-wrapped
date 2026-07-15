"use client";

import { useEffect, useMemo, useState } from "react";
import { GitCompare, Upload } from "lucide-react";
import type { ParsedExportData } from "@/types/instagram";
import { compareParsedExports } from "@/lib/accountInsights";
import { parseInstagramZip } from "@/lib/zipParser";
import { formatAccountDisplayName } from "@/lib/accountNameFilter";
import { loadSavedAnalyses, loadSavedAnalysisById } from "@/lib/cloudSave";

interface CompareTabProps {
  current: ParsedExportData;
}

export function CompareTab({ current }: CompareTabProps) {
  const [baseline, setBaseline] = useState<ParsedExportData | null>(null);
  const [baselineLabel, setBaselineLabel] = useState("Earlier export");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState("");
  const [savedOptions, setSavedOptions] = useState<
    { id: string; label: string }[]
  >([]);

  useEffect(() => {
    void (async () => {
      const { data } = await loadSavedAnalyses();
      setSavedOptions(
        data.map((s) => ({
          id: s.id,
          label: s.title ?? s.exportName ?? "Saved analysis",
        }))
      );
    })();
  }, []);

  const comparison = useMemo(() => {
    if (!baseline) return null;
    return compareParsedExports(baseline, current, baselineLabel, "Current");
  }, [baseline, current, baselineLabel]);

  const handleSecondZip = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const data = await parseInstagramZip(file);
      setBaseline(data);
      setBaselineLabel(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not parse ZIP.");
    } finally {
      setLoading(false);
    }
  };

  const pickSaved = async (id: string, label: string) => {
    const { data: row } = await loadSavedAnalysisById(id);
    const parsed = row?.full_analysis_json?.parsed;
    if (!parsed) return;
    setBaseline({
      ...parsed,
      filePaths: [],
      mostActiveEra: parsed.mostActiveEra ?? null,
      insights: parsed.insights ?? null,
    });
    setBaselineLabel(label);
  };

  const renderList = (title: string, items: string[]) => {
    const q = listFilter.trim().toLowerCase();
    const filtered = items.filter((u) => !q || u.includes(q)).slice(0, 20);
    if (!items.length) return null;
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
          {title} ({items.length})
        </p>
        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-sm text-white/70">
          {filtered.map((u) => (
            <li key={u}>{formatAccountDisplayName(u.replace(/_/g, " "))}</li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-[#DD2A7B]" />
          <h3 className="font-semibold text-white">Compare Exports</h3>
        </div>
        <p className="mt-2 text-sm text-white/50">
          Compare your current analysis with an older ZIP or saved snapshot.
          Based on available export data.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 hover:bg-white/10">
            <Upload className="h-3.5 w-3.5" />
            Upload older ZIP
            <input
              type="file"
              accept=".zip"
              className="hidden"
              disabled={loading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleSecondZip(f);
              }}
            />
          </label>
        </div>
        {savedOptions.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-white/40">Or compare with a saved analysis:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {savedOptions.slice(0, 5).map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => void pickSaved(row.id, row.label)}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/60 hover:bg-white/5"
                >
                  {row.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-300/90">{error}</p>}
        {loading && (
          <p className="mt-3 text-sm text-white/45">Parsing comparison ZIP…</p>
        )}
      </div>

      {!comparison ? (
        <p className="text-sm text-white/40">
          Upload a second export or pick a saved analysis to see changes.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {comparison.summary.map((row) => (
              <div
                key={row.label}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-4"
              >
                <p className="text-xs text-white/40">{row.label}</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {row.after}
                  {row.delta != null && row.delta !== 0 && (
                    <span
                      className={`ml-2 text-sm ${
                        row.delta > 0
                          ? "text-emerald-400"
                          : row.delta < 0
                            ? "text-red-400"
                            : "text-white/40"
                      }`}
                    >
                      {row.delta > 0 ? "+" : ""}
                      {row.delta}
                    </span>
                  )}
                </p>
                <p className="text-xs text-white/35">was {row.before}</p>
              </div>
            ))}
          </div>
          <input
            type="search"
            placeholder="Filter account lists…"
            value={listFilter}
            onChange={(e) => setListFilter(e.target.value)}
            className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {renderList("New followers", comparison.newFollowers)}
            {renderList("Lost followers", comparison.lostFollowers)}
            {renderList("New following", comparison.newFollowing)}
            {renderList("Unfollowed", comparison.unfollowed)}
            {renderList("New mutuals", comparison.newMutuals)}
            {renderList("Lost mutuals", comparison.lostMutuals)}
          </div>
        </>
      )}
    </div>
  );
}
