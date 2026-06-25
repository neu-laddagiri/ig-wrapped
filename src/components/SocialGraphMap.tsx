"use client";

import { useMemo, useState } from "react";
import { Map, ChevronDown } from "lucide-react";
import type { UnifiedAccount } from "@/types/insights";
import {
  buildSocialGraphNodes,
  type GraphFilter,
} from "@/lib/socialGraphMap";
import { formatAccountDisplayName } from "@/lib/accountNameFilter";
import { formatNumber } from "@/lib/formatters";

const FILTERS: { id: GraphFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "dms", label: "Direct DMs" },
  { id: "mutuals", label: "Mutuals" },
  { id: "realones", label: "Real Ones" },
  { id: "silent", label: "Silent mutuals" },
  { id: "cleanup", label: "Cleanup" },
];

const CLUSTER_LABELS: Record<string, string> = {
  dm: "Close DM",
  mutual: "Mutual",
  silent: "Silent",
  edge: "Outer network",
  group: "Group-heavy",
};

interface SocialGraphMapProps {
  accounts: UnifiedAccount[];
  showNames?: boolean;
  onOpenAccount?: (username: string) => void;
}

export function SocialGraphMap({
  accounts,
  showNames = true,
  onOpenAccount,
}: SocialGraphMapProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<GraphFilter>("all");

  const nodes = useMemo(
    () => buildSocialGraphNodes(accounts, filter, 50),
    [accounts, filter]
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-white">
          <Map className="h-4 w-4 text-[#DD2A7B]" />
          {open ? "Hide relationship map" : "Show relationship map"}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-white/40 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      <p className="mt-1 text-xs text-white/35">
        Optional — estimated from export data. Leaderboards below are the main view.
      </p>

      {open && (
        <div className="mt-4 border-t border-white/8 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[10px] uppercase tracking-wider text-white/35">
              Filter
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as GraphFilter)}
              className="rounded-lg border border-white/10 bg-[#12121a] px-2 py-1.5 text-xs text-white outline-none"
            >
              {FILTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-white/30">
              Top {nodes.length} accounts
            </span>
          </div>

          {!nodes.length ? (
            <p className="mt-4 text-sm text-white/45">
              Not enough accounts for this filter.
            </p>
          ) : (
            <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {nodes.map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => onOpenAccount?.(node.id)}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          node.cluster === "dm"
                            ? "#DD2A7B"
                            : node.cluster === "mutual"
                              ? "#515BD4"
                              : node.cluster === "silent"
                                ? "#64748b"
                                : node.cluster === "group"
                                  ? "#F58529"
                                  : "#475569",
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-white/85">
                      {showNames
                        ? formatAccountDisplayName(node.label)
                        : "Account"}
                    </span>
                    <span className="shrink-0 text-[10px] text-white/35">
                      {CLUSTER_LABELS[node.cluster]}
                    </span>
                    {node.dmCount > 0 && (
                      <span className="shrink-0 text-xs tabular-nums text-white/45">
                        {formatNumber(node.dmCount)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
