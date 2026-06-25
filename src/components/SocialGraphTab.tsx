"use client";

import { useMemo, useState } from "react";
import { Users, Trash2, Heart, Trophy, Search, ChevronDown } from "lucide-react";
import type { InsightsBundle } from "@/types/insights";
import { AccountSourcesPopover } from "@/components/AccountSourcesPopover";
import { formatAccountDisplayName } from "@/lib/accountNameFilter";
import type { NetworkStats } from "@/types/instagram";
import { TAB_SELECTED_PILL, TAB_INACTIVE_PILL } from "@/lib/tabStyles";
import { UnfollowImpactPanel } from "@/components/UnfollowImpactPanel";
import { ConfidencePill } from "@/components/ConfidencePill";
import { LeaderboardSection } from "@/components/LeaderboardSection";
import { SocialGraphMap } from "@/components/SocialGraphMap";
import { usePresentationMode } from "@/contexts/PresentationContext";

interface SocialGraphTabProps {
  insights: InsightsBundle | null;
  network?: NetworkStats | null;
  onOpenAccount?: (username: string) => void;
  defaultSubTab?: SubTab;
  showSubNav?: boolean;
  showUnfollowImpact?: boolean;
}

type SubTab = "cleanup" | "realones" | "leaderboards";

export function SocialGraphTab({
  insights,
  network = null,
  onOpenAccount,
  defaultSubTab = "leaderboards",
  showSubNav = true,
  showUnfollowImpact = false,
}: SocialGraphTabProps) {
  const [subTab, setSubTab] = useState<SubTab>(defaultSubTab);
  const [query, setQuery] = useState("");
  const [clusterFilter, setClusterFilter] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const { presentationMode } = usePresentationMode();
  const showNames = !presentationMode;

  const filteredCleanup = useMemo(() => {
    if (!insights) return [];
    const q = query.trim().toLowerCase();
    return insights.cleanup.filter(
      (c) =>
        !q ||
        c.displayName.toLowerCase().includes(q) ||
        c.username.includes(q)
    );
  }, [insights, query]);

  const filteredRealOnes = useMemo(() => {
    if (!insights) return [];
    const q = query.trim().toLowerCase();
    return insights.realOnes
      .filter((c) => !c.isSilentMutual && c.dmMessageCount > 0)
      .filter(
        (c) =>
          !q ||
          c.displayName.toLowerCase().includes(q) ||
          c.username.includes(q)
      );
  }, [insights, query]);

  if (!insights) {
    return (
      <EmptyState message="Re-upload your export and save again to unlock social graph insights." />
    );
  }

  const subs: { id: SubTab; label: string; icon: typeof Users }[] = [
    { id: "cleanup", label: "Cleanup", icon: Trash2 },
    { id: "realones", label: "Real Ones", icon: Heart },
    { id: "leaderboards", label: "Leaderboards", icon: Trophy },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#DD2A7B]/20 bg-gradient-to-br from-[#F58529]/10 via-[#DD2A7B]/10 to-[#515BD4]/10 p-5">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-[#DD2A7B]" />
          <h3 className="font-semibold text-white">Social Graph</h3>
        </div>
        <p className="mt-2 text-sm text-white/50">
          {insights.accounts.length.toLocaleString()} accounts unified from
          network, direct DMs, and interactions.
        </p>
        <p className="mt-1 text-xs text-white/35">
          Estimated from export data. Group chat totals count actual sender
          messages, not membership.
        </p>
      </div>

      {showSubNav && (
      <div className="flex flex-wrap gap-2">
        {subs.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSubTab(s.id)}
            className={`inline-flex items-center gap-1.5 ${
              subTab === s.id ? TAB_SELECTED_PILL : TAB_INACTIVE_PILL
            }`}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </div>
      )}

      {showUnfollowImpact && insights && (
        <UnfollowImpactPanel network={network} cleanup={insights.cleanup} />
      )}

      {(insights.networkClusters?.length ?? 0) > 0 && subTab === "leaderboards" && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h3 className="mb-3 font-semibold text-white">Network clusters</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {insights.networkClusters!.map((cluster) => (
              <button
                key={cluster.id}
                type="button"
                onClick={() =>
                  setClusterFilter(
                    clusterFilter === cluster.id ? null : cluster.id
                  )
                }
                className={`rounded-xl border p-3 text-left transition ${
                  clusterFilter === cluster.id
                    ? "border-[#DD2A7B]/40 bg-[#DD2A7B]/10"
                    : "border-white/10 bg-white/[0.03] hover:border-white/15"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-white">{cluster.title}</p>
                  <ConfidencePill level={cluster.confidence} />
                </div>
                <p className="mt-1 text-2xl font-bold text-white">{cluster.count}</p>
                <p className="mt-1 text-xs text-white/40">{cluster.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {(subTab === "cleanup" || subTab === "realones") && (
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search accounts…"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/30"
          />
        </div>
      )}

      {subTab === "realones" && (
        <p className="text-xs text-white/40 -mt-2">
          Relationship score from direct 1-on-1 DMs, mutual status, and
          likes/comments. Group membership alone does not count.
        </p>
      )}

      {subTab === "cleanup" && (
        <AccountTable
          rows={filteredCleanup.slice(0, 50).map((c) => ({
            username: c.username,
            name: formatAccountDisplayName(c.displayName),
            score: c.cleanupPriorityScore,
            label: c.label,
            action: c.recommendedAction,
            meta: `${c.dmMessageCount} direct DMs`,
          }))}
          scoreLabel="Priority"
          onOpen={onOpenAccount}
        />
      )}

      {subTab === "realones" && (
        <AccountTable
          rows={filteredRealOnes.slice(0, 30).map((c) => ({
            username: c.username,
            name: formatAccountDisplayName(c.displayName),
            score: c.realOnesScore,
            label: c.isSilentMutual ? "Silent mutual" : c.relationshipLabel,
            action: c.rankReason ?? `${c.dmMessageCount} direct DMs`,
            meta: `Score ${c.realOnesScore} · direct DMs only`,
            sourceBreakdown: c.sourceBreakdown,
          }))}
          scoreLabel="Real Ones"
          onOpen={onOpenAccount}
        />
      )}

      {subTab === "leaderboards" && (
        <div className="space-y-4">
          <p className="text-xs text-white/40">
            Highlight rankings from your export — expand any card for the full list.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {insights.leaderboards
              .filter((board) => board.id !== "silent-mutuals")
              .map((board) => (
              <LeaderboardSection
                key={board.id}
                board={board}
                onOpenAccount={onOpenAccount}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMapOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-white/60"
          >
            Show relationship map
            <ChevronDown
              className={`h-4 w-4 transition ${mapOpen ? "rotate-180" : ""}`}
            />
          </button>
          {mapOpen && (
          <SocialGraphMap
            accounts={insights.accounts}
            showNames={showNames}
            onOpenAccount={onOpenAccount}
          />
          )}
        </div>
      )}
    </div>
  );
}

function AccountTable({
  rows,
  scoreLabel,
  onOpen,
}: {
  rows: {
    username: string;
    name: string;
    score: number;
    label: string;
    action: string;
    meta: string;
    sourceBreakdown?: import("@/types/insights").AccountSourceBreakdown;
  }[];
  scoreLabel: string;
  onOpen?: (username: string) => void;
}) {
  if (!rows.length) {
    return (
      <p className="text-sm text-white/45">No accounts match your filters.</p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wider text-white/40">
            <th className="px-4 py-3">Account</th>
            <th className="px-4 py-3">{scoreLabel}</th>
            <th className="px-4 py-3">Label</th>
            <th className="px-4 py-3">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.username}
              className="border-b border-white/5 hover:bg-white/[0.02]"
            >
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => onOpen?.(row.username)}
                  className="font-medium text-white hover:text-[#DD2A7B]"
                >
                  {row.name}
                </button>
                <p className="text-xs text-white/35">
                  {!row.username.startsWith("unknown:")
                    ? `@${row.username}`
                    : "Deleted / unavailable in export"}
                </p>
              </td>
              <td className="px-4 py-3 font-semibold text-white">
                {row.score}
              </td>
              <td className="px-4 py-3 text-xs text-white/55">{row.label}</td>
              <td className="px-4 py-3 text-xs text-white/45">
                <div className="flex items-center gap-2">
                  <span>{row.action}</span>
                  <AccountSourcesPopover
                    breakdown={row.sourceBreakdown}
                    compact
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
      <Users className="mx-auto h-10 w-10 text-white/20" />
      <p className="mx-auto mt-4 max-w-md text-sm text-white/45">{message}</p>
    </div>
  );
}
