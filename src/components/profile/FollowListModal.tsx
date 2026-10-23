"use client";

import { useMemo, useState } from "react";
import { EyeOff, Search, X } from "lucide-react";
import type { InstagramAccount, NetworkStats } from "@/types/instagram";
import type { InsightsBundle } from "@/types/insights";
import { Modal } from "@/components/ig/Modal";
import { Avatar } from "@/components/ig/Avatar";
import { formatNumber, formatTimestamp } from "@/lib/formatters";

export type FollowListTab =
  | "followers"
  | "following"
  | "notFollowingBack"
  | "fans"
  | "mutuals"
  | "pending"
  | "requests"
  | "unfollowed"
  | "blocked"
  | "restricted";

type SortMode = "default" | "least" | "most" | "az";

const TAB_DEFS: {
  id: FollowListTab;
  label: string;
  pick: (n: NetworkStats) => InstagramAccount[];
  meta: string;
  /** Extra lists only appear when the export has entries for them. */
  optional?: boolean;
}[] = [
  { id: "followers", label: "Followers", pick: (n) => n.followers, meta: "Followed you" },
  { id: "following", label: "Following", pick: (n) => n.following, meta: "You followed" },
  { id: "notFollowingBack", label: "Not following back", pick: (n) => n.dontFollowMeBack, meta: "You followed" },
  { id: "fans", label: "Fans", pick: (n) => n.iDontFollowBack, meta: "Followed you" },
  { id: "mutuals", label: "Mutuals", pick: (n) => n.mutuals, meta: "Connected" },
  { id: "pending", label: "Pending", pick: (n) => n.pendingRequests, meta: "Requested", optional: true },
  { id: "requests", label: "Requests", pick: (n) => n.recentFollowRequests, meta: "Requested", optional: true },
  { id: "unfollowed", label: "Unfollowed", pick: (n) => n.recentlyUnfollowed, meta: "Unfollowed", optional: true },
  { id: "blocked", label: "Blocked", pick: (n) => n.blocked, meta: "Blocked", optional: true },
  { id: "restricted", label: "Restricted", pick: (n) => n.restricted, meta: "Restricted", optional: true },
];

const PAGE = 100;

interface FollowListModalProps {
  open: boolean;
  onClose: () => void;
  network: NetworkStats | null;
  insights: InsightsBundle | null;
  initialTab: FollowListTab;
  /** False while presenting; the list is replaced by a privacy notice. */
  showNames: boolean;
  onOpenAccount: (username: string) => void;
}

export function FollowListModal(props: FollowListModalProps) {
  if (!props.open) return null;
  // Keyed so each opening starts on the requested tab with a clear search.
  return <FollowListDialog key={props.initialTab} {...props} />;
}

function FollowListDialog({
  onClose,
  network,
  insights,
  initialTab,
  showNames,
  onOpenAccount,
}: FollowListModalProps) {
  const [tab, setTab] = useState<FollowListTab>(initialTab);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("default");
  const [limit, setLimit] = useState(PAGE);

  const tabs = useMemo(
    () => TAB_DEFS.filter((t) => !t.optional || (network && t.pick(network).length > 0) || t.id === initialTab),
    [network, initialTab]
  );
  const def = TAB_DEFS.find((t) => t.id === tab) ?? TAB_DEFS[0];

  // Cleanup priority = least interaction; Real Ones score = most.
  const scores = useMemo(() => {
    const cleanup = new Map<string, number>();
    const realOnes = new Map<string, number>();
    for (const c of insights?.cleanup ?? []) cleanup.set(c.username.toLowerCase(), c.cleanupPriorityScore);
    for (const r of insights?.realOnes ?? []) realOnes.set(r.username.toLowerCase(), r.realOnesScore);
    return { cleanup, realOnes };
  }, [insights]);

  const rows = useMemo(() => {
    const list = network ? def.pick(network) : [];
    const q = query.trim().toLowerCase().replace(/^@/, "");
    const filtered = q
      ? list.filter(
          (a) =>
            a.username.toLowerCase().includes(q) ||
            a.displayUsername.toLowerCase().includes(q)
        )
      : list;
    const sorted = [...filtered];
    if (sort === "az") sorted.sort((a, b) => a.username.localeCompare(b.username));
    else if (sort === "least")
      sorted.sort(
        (a, b) =>
          (scores.cleanup.get(b.username.toLowerCase()) ?? 0) -
          (scores.cleanup.get(a.username.toLowerCase()) ?? 0)
      );
    else if (sort === "most")
      sorted.sort(
        (a, b) =>
          (scores.realOnes.get(b.username.toLowerCase()) ?? 0) -
          (scores.realOnes.get(a.username.toLowerCase()) ?? 0)
      );
    else sorted.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    return sorted;
  }, [network, def, query, sort, scores]);

  const switchTab = (next: FollowListTab) => {
    setTab(next);
    setQuery("");
    setLimit(PAGE);
    if (next !== "following" && next !== "notFollowingBack" && (sort === "least" || sort === "most")) {
      setSort("default");
    }
  };

  const canRankInteraction = tab === "following" || tab === "notFollowingBack" || tab === "mutuals";

  return (
    <Modal open onClose={onClose} title={def.label} size="sm" bodyClassName="flex flex-col">
      {!showNames ? (
        <div className="flex flex-col items-center px-8 py-14 text-center">
          <EyeOff className="h-10 w-10 text-ig-muted" strokeWidth={1.5} />
          <p className="mt-4 text-base font-semibold">Hidden while presenting</p>
          <p className="mt-1 text-sm text-ig-muted">
            Turn off presentation mode in More to see who&apos;s on this list.
          </p>
        </div>
      ) : (
        <>
          <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto border-b border-ig-border px-4 py-3">
            {tabs.map((t) => {
              const count = network ? t.pick(network).length : 0;
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => switchTab(t.id)}
                  aria-pressed={active}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    active ? "bg-fg text-ig-bg" : "bg-ig-secondary text-fg hover:bg-ig-hover"
                  }`}
                >
                  {t.label} <span className={active ? "opacity-70" : "text-ig-muted"}>{formatNumber(count)}</span>
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-2 px-4 pt-3">
            <label className="relative flex flex-1 items-center">
              <span className="sr-only">Search {def.label.toLowerCase()}</span>
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-ig-muted" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setLimit(PAGE);
                }}
                placeholder="Search"
                className="h-9 w-full rounded-lg bg-ig-secondary pl-9 pr-8 text-sm text-fg outline-none placeholder:text-ig-muted"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 rounded-full p-1 text-ig-muted"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </label>
            <label className="sr-only" htmlFor="follow-sort">
              Sort
            </label>
            <select
              id="follow-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              className="h-9 rounded-lg bg-ig-secondary px-2 text-sm font-semibold text-fg outline-none"
            >
              <option value="default">Newest</option>
              <option value="az">A–Z</option>
              {canRankInteraction && <option value="least">Least interacted with</option>}
              {canRankInteraction && <option value="most">Most interacted with</option>}
            </select>
          </div>

          <ul className="min-h-[320px] px-4 py-2">
            {rows.slice(0, limit).map((account) => (
              <li key={account.username} className="flex items-center gap-3 py-2">
                <Avatar size={44} />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-semibold">{account.username}</p>
                  <p className="truncate text-sm text-ig-muted">
                    {account.timestamp
                      ? `${def.meta} ${formatTimestamp(account.timestamp)}`
                      : account.displayUsername !== account.username
                        ? account.displayUsername
                        : def.meta}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenAccount(account.username)}
                  className="shrink-0 rounded-lg bg-ig-secondary px-4 py-1.5 text-sm font-semibold text-fg hover:bg-ig-hover"
                >
                  View
                </button>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="py-16 text-center text-sm text-ig-muted">
                {query ? "No accounts match that search." : "Nobody on this list."}
              </li>
            )}
          </ul>
          {rows.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE)}
              className="mx-4 mb-4 rounded-lg py-2 text-sm font-semibold text-ig-blue hover:bg-ig-hover"
            >
              Show {formatNumber(Math.min(PAGE, rows.length - limit))} more
            </button>
          )}
        </>
      )}
    </Modal>
  );
}
