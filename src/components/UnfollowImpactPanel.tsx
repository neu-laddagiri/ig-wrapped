"use client";

import { useMemo, useState } from "react";
import { Copy, Download, AlertTriangle, Check } from "lucide-react";
import type { CleanupAccount } from "@/types/insights";
import type { NetworkStats } from "@/types/instagram";
import { escapeCsvCell } from "@/lib/exportCsv";
import { TAB_SELECTED_PILL, TAB_INACTIVE_PILL } from "@/lib/tabStyles";
import { redactNameLabel } from "@/lib/dmDisplayLabels";
import { usePresentationMode } from "@/contexts/PresentationContext";

type Preset =
  | "high"
  | "medium-high"
  | "no-followback"
  | "silent";

interface UnfollowImpactPanelProps {
  network: NetworkStats | null;
  cleanup: CleanupAccount[];
}

const VISIBLE_LIMIT = 100;

export function UnfollowImpactPanel({
  network,
  cleanup,
}: UnfollowImpactPanelProps) {
  const { presentationMode } = usePresentationMode();
  const showNames = !presentationMode;
  const [preset, setPreset] = useState<Preset>("high");
  // null = untouched preset, which defaults to every candidate selected.
  const [picked, setPicked] = useState<{ preset: Preset; usernames: Set<string> } | null>(null);
  const [copied, setCopied] = useState(false);

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

  const selected = useMemo(() => {
    const all = candidates.map((c) => c.username);
    if (!picked || picked.preset !== preset) return new Set(all);
    return new Set(all.filter((u) => picked.usernames.has(u)));
  }, [candidates, picked, preset]);

  const mutualUsernames = useMemo(
    () => new Set(network?.mutuals.map((m) => m.username) ?? []),
    [network]
  );

  const selectedMutuals = useMemo(() => {
    let n = 0;
    for (const u of selected) if (mutualUsernames.has(u)) n++;
    return n;
  }, [selected, mutualUsernames]);

  const following = network?.totalFollowing ?? 0;
  const mutuals = network?.mutuals.length ?? 0;
  const removeCount = selected.size;
  const newFollowing = Math.max(0, following - removeCount);
  const newMutuals = Math.max(0, mutuals - selectedMutuals);
  const currentRatio = network?.followBackRatio ?? 0;
  const projectedRatio =
    newFollowing > 0 ? newMutuals / newFollowing : 0;

  const setSelection = (usernames: Set<string>) =>
    setPicked({ preset, usernames });

  const toggle = (username: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(username);
    else next.delete(username);
    setSelection(next);
  };

  const copyUsernames = async () => {
    const text = [...selected].map((u) => `@${u}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (permissions / insecure context)
    }
  };

  const exportCsv = () => {
    const rows = [
      "username,displayName,cleanupScore",
      ...candidates
        .filter((c) => selected.has(c.username))
        .map((c) =>
          [c.username, c.displayName, c.cleanupPriorityScore]
            .map((cell) => escapeCsvCell(cell))
            .join(",")
        ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cleanup-selected.csv";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
            aria-pressed={preset === id}
            onClick={() => {
              setPreset(id);
              setPicked(null);
            }}
            className={preset === id ? TAB_SELECTED_PILL : TAB_INACTIVE_PILL}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ImpactStat
          label="Selected"
          value={`${removeCount} of ${candidates.length}`}
        />
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
          onClick={() => setSelection(new Set(candidates.map((c) => c.username)))}
          disabled={removeCount === candidates.length}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 disabled:opacity-40"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={() => setSelection(new Set())}
          disabled={removeCount === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 disabled:opacity-40"
        >
          Select none
        </button>
        {showNames && (
          <button
            type="button"
            onClick={copyUsernames}
            disabled={removeCount === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 disabled:opacity-40"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden />
            )}
            {copied ? "Copied" : "Copy usernames"}
          </button>
        )}
        <button
          type="button"
          onClick={exportCsv}
          disabled={removeCount === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Export CSV
        </button>
      </div>

      <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto">
        {candidates.slice(0, VISIBLE_LIMIT).map((c) => (
          <li key={c.username}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5">
              <input
                type="checkbox"
                checked={selected.has(c.username)}
                onChange={(e) => toggle(c.username, e.target.checked)}
                className="accent-[#DD2A7B]"
              />
              <span className="text-white/80">
                {redactNameLabel(c.displayName, showNames)}
              </span>
              {showNames && (
                <span className="text-xs text-white/35">@{c.username}</span>
              )}
            </label>
          </li>
        ))}
      </ul>
      {candidates.length > VISIBLE_LIMIT && (
        <p className="mt-2 text-xs text-white/40">
          Showing {VISIBLE_LIMIT} of {candidates.length} candidates. Select
          all / none, copy, and export apply to every candidate.
        </p>
      )}

      <p className="mt-3 flex items-start gap-2 text-xs text-amber-200/70">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
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
