"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search, Users } from "lucide-react";
import type { InsightsBundle } from "@/types/insights";
import type { NetworkStats } from "@/types/instagram";
import { AccountSourcesPopover } from "@/components/AccountSourcesPopover";
import { redactNameLabel } from "@/lib/dmDisplayLabels";
import { getSecondaryLabel } from "@/lib/accountIdentity";
import { UnfollowImpactPanel } from "@/components/UnfollowImpactPanel";
import { LeaderboardSection } from "@/components/LeaderboardSection";
import { Avatar } from "@/components/ig/Avatar";
import { usePresentationMode } from "@/contexts/PresentationContext";

interface SocialGraphTabProps {
  insights: InsightsBundle | null;
  network?: NetworkStats | null;
  onOpenAccount?: (username: string) => void;
  defaultSubTab?: SubTab;
  showUnfollowImpact?: boolean;
}

type SubTab = "realones" | "cleanup" | "leaderboards";

const SUBS: { id: SubTab; label: string; blurb: string }[] = [
  {
    id: "realones",
    label: "Real Ones",
    blurb: "Ranked from 1-on-1 DMs, mutual follows, likes and comments. Group chat membership alone doesn't count.",
  },
  {
    id: "cleanup",
    label: "Cleanup",
    blurb: "Accounts you follow with the least going on. IG Wrapped never unfollows anyone for you.",
  },
  {
    id: "leaderboards",
    label: "Leaderboards",
    blurb: "Who shows up most in your DMs, likes and comments.",
  },
];

const PRIORITY_TONE: Record<string, string> = {
  high: "text-ig-bad",
  medium: "text-ig-warn",
  low: "text-ig-muted",
};

/** The profile's People tab: Real Ones, cleanup candidates and leaderboards. */
export function SocialGraphTab({
  insights,
  network = null,
  onOpenAccount,
  defaultSubTab = "realones",
  showUnfollowImpact = false,
}: SocialGraphTabProps) {
  const [subTab, setSubTab] = useState<SubTab>(defaultSubTab);
  const [query, setQuery] = useState("");
  const [planOpen, setPlanOpen] = useState(false);
  const { presentationMode } = usePresentationMode();
  const showNames = !presentationMode;
  // A typed query can be a name, so it is neither shown nor applied while presenting.
  const activeQuery = showNames ? query.trim().toLowerCase() : "";

  const realOnes = useMemo(() => {
    if (!insights) return [];
    return insights.realOnes
      .filter((c) => !c.isSilentMutual && c.dmMessageCount > 0)
      .filter(
        (c) =>
          !activeQuery ||
          c.displayName.toLowerCase().includes(activeQuery) ||
          c.username.toLowerCase().includes(activeQuery)
      );
  }, [insights, activeQuery]);

  const cleanup = useMemo(() => {
    if (!insights) return [];
    return insights.cleanup.filter(
      (c) =>
        !activeQuery ||
        c.displayName.toLowerCase().includes(activeQuery) ||
        c.username.toLowerCase().includes(activeQuery)
    );
  }, [insights, activeQuery]);

  if (!insights) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <Users className="h-10 w-10 text-ig-muted" strokeWidth={1.5} />
        <p className="mt-3 max-w-sm text-sm text-ig-muted">
          Re-upload your export to unlock people insights.
        </p>
      </div>
    );
  }

  const current = SUBS.find((s) => s.id === subTab) ?? SUBS[0];

  return (
    <div className="mx-auto max-w-[614px]">
      <div className="flex rounded-lg bg-ig-secondary p-1" role="tablist" aria-label="People">
        {SUBS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={subTab === s.id}
            onClick={() => setSubTab(s.id)}
            className={`flex-1 rounded-md py-1.5 text-sm font-semibold transition-colors ${
              subTab === s.id ? "bg-ig-bg text-fg shadow-sm" : "text-ig-muted hover:text-fg"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-ig-muted">{current.blurb}</p>

      {subTab !== "leaderboards" && (
        <label className="relative mt-4 flex items-center">
          <span className="sr-only">Search accounts</span>
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-ig-muted" aria-hidden />
          <input
            type="search"
            value={showNames ? query : ""}
            disabled={!showNames}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={showNames ? "Search" : "Search is off while presenting"}
            className="h-9 w-full rounded-lg bg-ig-secondary pl-9 pr-3 text-sm text-fg outline-none placeholder:text-ig-muted disabled:opacity-60"
          />
        </label>
      )}

      {subTab === "realones" && (
        <PeopleList
          showNames={showNames}
          onOpen={onOpenAccount}
          rows={realOnes.slice(0, 30).map((c, i) => ({
            username: c.username,
            name: redactNameLabel(c.displayName, showNames),
            rank: i + 1,
            detail: c.rankReason ?? `${c.dmMessageCount.toLocaleString()} direct DMs`,
            badge: `${c.realOnesScore}`,
            sourceBreakdown: c.sourceBreakdown,
          }))}
          empty="No direct-message friends found in this export."
        />
      )}

      {subTab === "cleanup" && (
        <>
          {showUnfollowImpact && network && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setPlanOpen((v) => !v)}
                aria-expanded={planOpen}
                className="flex w-full items-center justify-between rounded-lg border border-ig-border px-4 py-3 text-left text-sm font-semibold hover:bg-ig-hover"
              >
                <span>
                  Plan an unfollow batch
                  <span className="block text-xs font-normal text-ig-muted">
                    See how your follow-back rate would change before you unfollow anyone
                  </span>
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${planOpen ? "rotate-180" : ""}`} />
              </button>
              {planOpen && (
                <div className="mt-3">
                  <UnfollowImpactPanel network={network} cleanup={insights.cleanup} />
                </div>
              )}
            </div>
          )}
          <PeopleList
            showNames={showNames}
            onOpen={onOpenAccount}
            rows={cleanup.slice(0, 50).map((c) => {
              const level = c.label.toLowerCase().includes("high")
                ? "high"
                : c.label.toLowerCase().includes("medium")
                  ? "medium"
                  : "low";
              return {
                username: c.username,
                name: redactNameLabel(c.displayName, showNames),
                detail: c.recommendedAction,
                tag: { text: c.label, tone: PRIORITY_TONE[level] },
              };
            })}
            empty="Nothing to clean up — everyone you follow has some signal."
          />
        </>
      )}

      {subTab === "leaderboards" && (
        <div className="mt-5 space-y-4">
          {insights.leaderboards
            .filter((board) => board.id !== "silent-mutuals")
            .map((board) => (
              <LeaderboardSection key={board.id} board={board} onOpenAccount={onOpenAccount} />
            ))}
        </div>
      )}
    </div>
  );
}

interface PeopleRow {
  username: string;
  name: string;
  rank?: number;
  detail: string;
  badge?: string;
  tag?: { text: string; tone: string };
  sourceBreakdown?: import("@/types/insights").AccountSourceBreakdown;
}

function PeopleList({
  rows,
  showNames,
  onOpen,
  empty,
}: {
  rows: PeopleRow[];
  showNames: boolean;
  onOpen?: (username: string) => void;
  empty: string;
}) {
  if (!rows.length) {
    return <p className="py-12 text-center text-sm text-ig-muted">{empty}</p>;
  }
  return (
    <ul className="mt-4 divide-y divide-ig-border">
      {rows.map((row) => (
        <li key={row.username} className="flex items-center gap-3 py-3">
          {row.rank !== undefined && (
            <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-ig-muted">
              {row.rank}
            </span>
          )}
          <Avatar size={44} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold">{row.name}</p>
            {showNames && (
              <p className="truncate text-xs text-ig-muted">
                {row.username.startsWith("unknown:")
                  ? "Deleted or unavailable in export"
                  : getSecondaryLabel({ username: row.username })}
              </p>
            )}
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ig-muted">
              {row.tag && <span className={`font-semibold ${row.tag.tone}`}>{row.tag.text}</span>}
              {row.tag && <span aria-hidden>·</span>}
              <span className="truncate">{row.detail}</span>
              <AccountSourcesPopover breakdown={row.sourceBreakdown} compact />
            </div>
          </div>
          {row.badge && (
            <span className="shrink-0 rounded-full bg-ig-gradient px-2.5 py-1 text-xs font-bold tabular-nums text-white" title="Real Ones score">
              {row.badge}
            </span>
          )}
          {onOpen && showNames && (
            <button
              type="button"
              onClick={() => onOpen(row.username)}
              className="shrink-0 rounded-lg bg-ig-secondary px-4 py-1.5 text-sm font-semibold hover:bg-ig-hover"
            >
              View
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
