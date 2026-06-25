"use client";

import { useState } from "react";
import { Database, AlertTriangle, ChevronDown } from "lucide-react";
import type { DmThreadDebugEntry, InsightsBundle } from "@/types/insights";

interface DataExplorerTabProps {
  insights: InsightsBundle | null;
}

export function DataExplorerTab({ insights }: DataExplorerTabProps) {
  const [showRaw, setShowRaw] = useState(false);

  if (!insights) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
        <Database className="mx-auto h-10 w-10 text-white/20" />
        <p className="mt-4 text-sm text-white/45">Upload an export to explore file metadata.</p>
      </div>
    );
  }

  const { dataExplorer, exportCompleteness } = insights;
  const byCategory = new Map<string, number>();
  for (const f of dataExplorer.files) {
    byCategory.set(f.category, (byCategory.get(f.category) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Total files" value={dataExplorer.totalCount} />
        <Stat label="JSON files" value={dataExplorer.jsonCount} />
        <Stat label="Media files" value={dataExplorer.mediaCount} />
        <Stat
          label="Export quality"
          value={`${exportCompleteness.score}/100`}
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h3 className="font-semibold text-white">Categories detected</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {[...byCategory.entries()].map(([cat, count]) => (
            <span
              key={cat}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65"
            >
              {cat}: {count}
            </span>
          ))}
        </div>
        {exportCompleteness.missing.length > 0 && (
          <p className="mt-3 text-xs text-white/40">
            Missing: {exportCompleteness.missing.join(", ")}
          </p>
        )}
      </div>

      {dataExplorer.leaderboardSources &&
        Object.keys(dataExplorer.leaderboardSources).length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <h3 className="font-semibold text-white">Leaderboard data sources</h3>
            <p className="mt-1 text-xs text-white/40">
              Helps verify where account rankings came from.
            </p>
            <ul className="mt-3 space-y-2 text-xs text-white/55">
              {Object.entries(dataExplorer.leaderboardSources).map(
                ([id, note]) => (
                  <li key={id} className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                    <span className="font-medium text-white/70">{id}</span>
                    <span className="text-white/40"> — {note}</span>
                  </li>
                )
              )}
            </ul>
          </div>
        )}

      {dataExplorer.dmThreadDebug && dataExplorer.dmThreadDebug.length > 0 && (
        <DmThreadDebugPanel entries={dataExplorer.dmThreadDebug} />
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h3 className="mb-3 font-semibold text-white">File index</h3>
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[#0a0a10] text-white/40">
              <tr>
                <th className="py-2 pr-3">Path</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2">Used</th>
              </tr>
            </thead>
            <tbody>
              {dataExplorer.files.slice(0, 200).map((f) => (
                <tr key={f.path} className="border-t border-white/5">
                  <td className="max-w-xs truncate py-2 pr-3 text-white/60">
                    {f.path}
                  </td>
                  <td className="py-2 pr-3 text-white/45">{f.category}</td>
                  <td className="py-2 text-white/40">
                    {f.contributed ? "Yes" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
        <label className="flex items-center gap-2 text-sm text-amber-100/90">
          <input
            type="checkbox"
            checked={showRaw}
            onChange={(e) => setShowRaw(e.target.checked)}
            className="accent-amber-400"
          />
          Show raw JSON preview (advanced)
        </label>
        {showRaw && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100/80">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Raw JSON may contain private content. Metadata-only view is shown in
            the file index above.
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs text-white/40">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function DmThreadDebugPanel({ entries }: { entries: DmThreadDebugEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const [showCount, setShowCount] = useState(15);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h3 className="font-semibold text-white">DM parser debug</h3>
          <p className="mt-1 text-xs text-white/40">
            {entries.length} normalized threads — verify direct vs group attribution
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-white/40 transition ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
          {entries.slice(0, showCount).map((t) => (
            <div
              key={t.threadId}
              className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-xs"
            >
              <p className="font-medium text-white/80">{t.title}</p>
              <p className="mt-1 text-white/40">
                {t.isGroup ? "Group" : "1-on-1"} · {t.participantCount} people ·{" "}
                {t.totalMessages} msgs · confidence {t.nameConfidence}
              </p>
              {t.inferredOtherParticipant && (
                <p className="text-white/50">
                  Other: {t.inferredOtherParticipant}
                  {t.isUnknownAccount ? " (unknown/deleted)" : ""}
                </p>
              )}
              <p className="mt-1 text-white/35">
                Direct board: {t.contributesToDirectLeaderboard ? "yes" : "no"} ·
                Group board: {t.contributesToGroupLeaderboard ? "yes" : "no"}
              </p>
              {t.sourcePath && (
                <p className="mt-1 truncate text-white/30">{t.sourcePath}</p>
              )}
            </div>
          ))}
          {showCount < entries.length && (
            <button
              type="button"
              onClick={() => setShowCount((n) => n + 25)}
              className="text-xs text-[#DD2A7B] hover:underline"
            >
              Show more threads
            </button>
          )}
        </div>
      )}
    </div>
  );
}
