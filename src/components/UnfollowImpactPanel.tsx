"use client";

import { useMemo, useState } from "react";
import { Copy, Download, AlertTriangle } from "lucide-react";
import type { CleanupAccount } from "@/types/insights";
import type { NetworkStats } from "@/types/instagram";
import { escapeCsvCell } from "@/lib/exportCsv";
import { TAB_SELECTED_PILL, TAB_INACTIVE_PILL } from "@/lib/tabStyles";

type Preset =
  | "high"
  | "medium-high"
  | "no-followback"
  | "silent";

interface UnfollowImpactPanelProps {
  network: NetworkStats | null;
  cleanup: CleanupAccount[];
}

export function UnfollowImpactPanel({
  network,
  cleanup,
}: UnfollowImpactPanelProps) {
  const [preset, setPreset] = useState<Preset>("high");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const candidates = useMemo(() => {
    if (preset === "high") {
      return cleanup.filter((c) => c.label.toLowerCase().includes("high"));
    }
    if (preset === "medium-high") {
      return cleanup.filter((c) =>
        /high|medium/.test(c.label.toLowerCase())
      );
    }
    if (preset === "no-followback") {
      return cleanup.filter((c) => c.iFollowThem && !c.followsMe && c.dmMessageCount === 0);
    }
    return cleanup.filter(
      (c) => c.isMutual && c.dmMessageCount === 0 && c.cleanupPriorityScore > 40
    );
  }, [cleanup, preset]);

  const effectiveSelected = useMemo(() => {
    if (selected.size > 0) return selected;
    return new Set(candidates.map((c) => c.username));
  }, [selected, candidates]);

  const following = network?.totalFollowing ?? 0;
  const mutuals = network?.mutuals.length ?? 0;
  const removeCount = effectiveSelected.size;
  const newFollowing = Math.max(0, following - removeCount);
  const newMutuals = Math.max(
    0,
    mutuals -
      [...effectiveSelected].filter((u) =>
        network?.mutuals.some((m) => m.username === u)
      ).length
  );
  const currentRatio = network?.followBackRatio ?? 0;
  const projectedRatio =
    newFollowing > 0 ? newMutuals / newFollowing : 0;

  const copyUsernames = async () => {
    const text = [...effectiveSelected].map((u) => `@${u}`).join("\n");
    await navigator.clipboard.writeText(text);
  };

  const exportCsv = () => {
    const rows = [
      "username,displayName,cleanupScore",
      ...candidates
        .filter((c) => effectiveSelected.has(c.username))
        .map((c) =>
          [c.username, c.displayName, c.cleanupPriorityScore]
            .map(escapeCsvCell)
            .join(",")
        ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cleanup-selected.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!network) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h4 className="font-semibold text-white">Unfollow impact preview</h4>
      <p className="mt-1 text-xs text-white/45">
        Manual planning tool — IG Wrapped does not unfollow anyone automatically.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["high", "High priority"],
            ["medium-high", "Medium + high"],
            ["no-followback", "No follow-back, no DMs"],
            ["silent", "Silent dead follows"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setPreset(id);
              setSelected(new Set());
            }}
            className={preset === id ? TAB_SELECTED_PILL : TAB_INACTIVE_PILL}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ImpactStat label="Selected" value={String(removeCount)} />
        <ImpactStat
          label="Following after"
          value={`${newFollowing} (was ${following})`}
        />
        <ImpactStat
          label="Follow-back ratio"
          value={`${Math.round(projectedRatio * 100)}% (was ${Math.round(currentRatio * 100)}%)`}
        />
        <ImpactStat label="Mutuals after" value={String(newMutuals)} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyUsernames}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy usernames
        </button>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto">
        {candidates.slice(0, 15).map((c) => (
          <li key={c.username}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5">
              <input
                type="checkbox"
                checked={effectiveSelected.has(c.username)}
                onChange={(e) => {
                  const next = new Set(selected.size ? selected : candidates.map((x) => x.username));
                  if (e.target.checked) next.add(c.username);
                  else next.delete(c.username);
                  setSelected(next);
                }}
                className="accent-[#DD2A7B]"
              />
              <span className="text-white/80">{c.displayName}</span>
              <span className="text-xs text-white/35">@{c.username}</span>
            </label>
          </li>
        ))}
      </ul>

      <p className="mt-3 flex items-start gap-2 text-xs text-amber-200/70">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Open Instagram profiles manually to unfollow. This is an estimate based
        on export data.
      </p>
    </div>
  );
}

function ImpactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-white/35">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-white">{value}</p>
    </div>
  );
}
