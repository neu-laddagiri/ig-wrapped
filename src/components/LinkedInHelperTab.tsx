"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Briefcase,
  Download,
  Search,
  ExternalLink,
  Info,
  Trash2,
} from "lucide-react";
import type {
  LinkedInHelperEntry,
  LinkedInSource,
  LinkedInStatus,
  NetworkStats,
  PageSize,
} from "@/types/instagram";
import type { CanonicalAccount } from "@/lib/canonicalAccounts";
import type { AccountReceiptTarget } from "@/lib/canonicalAccounts";
import type { DirectDmIndex } from "@/lib/insights/directDmIndex";
import {
  buildLinkedInHelperRows,
  compareLinkedInRows,
  type LinkedInSortMode,
} from "@/lib/linkedinRows";
import { exportLinkedInHelperCsv } from "@/lib/exportCsv";
import { getAccountsForLinkedInSource } from "@/lib/networkAccountDetail";
import {
  loadLinkedInProgress,
  saveLinkedInProgress,
  clearLinkedInProgress,
} from "@/lib/linkedinStorage";
import { TablePagination, paginate } from "@/components/TablePagination";

interface LinkedInHelperTabProps {
  network: NetworkStats | null;
  fingerprint: string;
  canonicalAccounts: CanonicalAccount[];
  directDmIndex: DirectDmIndex;
  entries: LinkedInHelperEntry[];
  onEntriesChange: (entries: LinkedInHelperEntry[]) => void;
  onOpenAccount: (target: AccountReceiptTarget) => void;
}

type SortMode = LinkedInSortMode;

type InteractionFilter =
  | "all"
  | "direct-dm"
  | "mutuals"
  | "hide-unknown"
  | "hide-silent"
  | "dont-follow-back"
  | "i-dont-follow-back"
  | "not-reviewed"
  | "has-notes";

const STATUS_OPTIONS: { value: LinkedInStatus; label: string }[] = [
  { value: "not-reviewed", label: "Not reviewed" },
  { value: "found", label: "Found" },
  { value: "request-sent", label: "Request sent manually" },
  { value: "connected", label: "Already connected" },
  { value: "skip", label: "Skip" },
  { value: "not-found", label: "Not found" },
];

const SOURCE_OPTIONS: { value: LinkedInSource; label: string }[] = [
  { value: "all", label: "All network" },
  { value: "mutuals", label: "Mutuals" },
  { value: "followers", label: "Followers" },
  { value: "following", label: "Following" },
  { value: "dontFollowMeBack", label: "Don't follow me back" },
  { value: "iDontFollowBack", label: "I don't follow back" },
];

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "most-interacted", label: "Most interacted" },
  { value: "direct-dms", label: "Direct DMs" },
  { value: "recent-dm", label: "Recent DM activity" },
  { value: "mutuals-first", label: "Mutuals first" },
  { value: "followers", label: "Followers" },
  { value: "following", label: "Following" },
  { value: "alphabetical", label: "Alphabetical" },
  { value: "not-reviewed", label: "Not reviewed" },
];

const INTERACTION_FILTERS: { value: InteractionFilter; label: string }[] = [
  { value: "all", label: "All accounts" },
  { value: "direct-dm", label: "Direct DM contacts only" },
  { value: "mutuals", label: "Mutuals only" },
  { value: "hide-unknown", label: "Hide unknown/deleted" },
  { value: "hide-silent", label: "Hide silent mutuals" },
  { value: "dont-follow-back", label: "Don't follow me back" },
  { value: "i-dont-follow-back", label: "I don't follow back" },
  { value: "not-reviewed", label: "Not reviewed" },
  { value: "has-notes", label: "Has notes" },
];

function openLinkedInSearch(username: string, displayName: string) {
  const query =
    displayName && displayName !== username
      ? `"${displayName}" LinkedIn`
      : `"${username}" Instagram LinkedIn`;
  window.open(
    `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    "_blank",
    "noopener,noreferrer"
  );
}

export function LinkedInHelperTab({
  network,
  fingerprint,
  canonicalAccounts,
  directDmIndex,
  entries,
  onEntriesChange,
  onOpenAccount,
}: LinkedInHelperTabProps) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [source, setSource] = useState<LinkedInSource>("all");
  const [statusFilter, setStatusFilter] = useState<LinkedInStatus | "all">(
    "all"
  );
  const [sortMode, setSortMode] = useState<SortMode>("most-interacted");
  const [interactionFilter, setInteractionFilter] =
    useState<InteractionFilter>("hide-unknown");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [progressLoaded, setProgressLoaded] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const entryByUsername = useMemo(() => {
    const map = new Map<string, LinkedInHelperEntry>();
    for (const entry of entries) {
      map.set(entry.username, entry);
    }
    return map;
  }, [entries]);

  const sourceAccounts = useMemo(() => {
    if (!network) return [];
    return getAccountsForLinkedInSource(network, source);
  }, [network, source]);

  useEffect(() => {
    if (!fingerprint || progressLoaded) return;
    const stored = loadLinkedInProgress(fingerprint);
    if (stored?.length) onEntriesChange(stored);
    setProgressLoaded(true);
  }, [fingerprint, progressLoaded, onEntriesChange]);

  useEffect(() => {
    if (!fingerprint || !progressLoaded || entries.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveLinkedInProgress(fingerprint, entries);
    }, 400);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [entries, fingerprint, progressLoaded]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, source, statusFilter, sortMode, interactionFilter]);

  const baseRows = useMemo(
    () =>
      buildLinkedInHelperRows({
        directDmIndex,
        canonicalAccounts,
        sourceAccounts,
        source,
        entryByUsername,
      }),
    [
      directDmIndex,
      canonicalAccounts,
      sourceAccounts,
      source,
      entryByUsername,
    ]
  );

  const displayRows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();

    const filtered = baseRows.filter((row) => {
      const { entry, directDmCount, isMutual, isUnknown, isSilentMutual, displayLabel, secondaryLabel } =
        row;

      if (statusFilter !== "all" && entry.status !== statusFilter) {
        return false;
      }
      if (
        q &&
        !entry.username.includes(q) &&
        !entry.displayUsername.toLowerCase().includes(q) &&
        !displayLabel.toLowerCase().includes(q) &&
        !secondaryLabel.toLowerCase().includes(q) &&
        !(entry.category?.toLowerCase().includes(q) ?? false)
      ) {
        return false;
      }

      if (interactionFilter === "hide-unknown" && isUnknown) return false;
      if (interactionFilter === "hide-silent" && isSilentMutual) return false;
      if (interactionFilter === "direct-dm" && directDmCount === 0) {
        return false;
      }
      if (interactionFilter === "mutuals" && !isMutual) return false;
      if (
        interactionFilter === "dont-follow-back" &&
        entry.category !== "dontFollowMeBack"
      ) {
        return false;
      }
      if (
        interactionFilter === "i-dont-follow-back" &&
        entry.category !== "iDontFollowBack"
      ) {
        return false;
      }
      if (
        interactionFilter === "not-reviewed" &&
        entry.status !== "not-reviewed"
      ) {
        return false;
      }
      if (interactionFilter === "has-notes" && !entry.notes.trim()) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => compareLinkedInRows(a, b, sortMode));
  }, [
    baseRows,
    debouncedSearch,
    statusFilter,
    interactionFilter,
    sortMode,
  ]);

  const pagedRows = useMemo(
    () => paginate(displayRows, page, pageSize),
    [displayRows, page, pageSize]
  );

  const updateEntry = useCallback(
    (username: string, patch: Partial<LinkedInHelperEntry>) => {
      onEntriesChange(
        entries.map((e) =>
          e.username === username ? { ...e, ...patch } : e
        )
      );
    },
    [entries, onEntriesChange]
  );

  const handleExport = useCallback(() => {
    if (!network) return;
    exportLinkedInHelperCsv(
      displayRows.map(({ entry }) => entry),
      "linkedin-helper.csv"
    );
  }, [network, displayRows]);

  const handleClearProgress = useCallback(() => {
    if (!fingerprint) return;
    if (!confirm("Clear all LinkedIn helper progress for this export?")) return;
    clearLinkedInProgress(fingerprint);
    onEntriesChange([]);
  }, [fingerprint, onEntriesChange]);

  if (!network) {
    return (
      <p className="py-12 text-center text-sm text-white/40">
        Upload an export with followers/following data to use LinkedIn helper.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">LinkedIn helper</h2>
          <p className="text-xs text-white/40">
            Ranked from the same 1-on-1 DM threads as the DMs tab. Network-only
            accounts appear after everyone you actually DM.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleClearProgress}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300/80 hover:bg-red-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear progress
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search username or name…"
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#DD2A7B]/40"
          />
        </div>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as LinkedInSource)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
        >
          {SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Sort: {opt.label}
            </option>
          ))}
        </select>
        <select
          value={interactionFilter}
          onChange={(e) =>
            setInteractionFilter(e.target.value as InteractionFilter)
          }
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
        >
          {INTERACTION_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-[#515BD4]/20 bg-[#515BD4]/8 px-3 py-2 text-xs text-white/50">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#818cf8]" />
        <p>
          Most interacted: direct DM count → last DM date → mutual / follower /
          following → username. No likes, comments, or fuzzy name matching.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wider text-white/40">
              <th className="px-4 py-3">Account</th>
              <th className="px-4 py-3">Direct DMs</th>
              <th className="px-4 py-3">Why ranked</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Instagram</th>
              <th className="px-4 py-3">LinkedIn</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-12 text-center text-white/40"
                >
                  No accounts match your filters.
                </td>
              </tr>
            ) : (
              pagedRows.map(
                ({
                  entry,
                  accountKey,
                  threadId,
                  displayLabel,
                  secondaryLabel,
                  directDmCount,
                  reason,
                }) => (
                  <tr
                    key={`${entry.username}:${threadId ?? accountKey}`}
                    className="border-b border-white/5 hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          onOpenAccount({ accountKey, threadId })
                        }
                        className="text-left font-medium text-white hover:text-[#DD2A7B]"
                      >
                        {displayLabel}
                      </button>
                      <p className="text-[10px] text-white/35">
                        {secondaryLabel}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-white">
                      {directDmCount > 0
                        ? directDmCount.toLocaleString()
                        : "—"}
                    </td>
                    <td className="max-w-[220px] px-4 py-3 text-xs leading-snug text-white/45">
                      {reason}
                    </td>
                    <td className="max-w-[100px] truncate px-4 py-3 text-xs capitalize text-white/45">
                      {entry.category ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={entry.instagramHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#DD2A7B] hover:underline"
                      >
                        IG profile
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          openLinkedInSearch(entry.username, displayLabel)
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-[#515BD4]/30 bg-[#515BD4]/10 px-2 py-1 text-xs text-[#818cf8] hover:bg-[#515BD4]/20"
                      >
                        <Briefcase className="h-3 w-3" />
                        Search LinkedIn
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={entry.status}
                        onChange={(e) =>
                          updateEntry(entry.username, {
                            status: e.target.value as LinkedInStatus,
                          })
                        }
                        className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={entry.notes}
                        onChange={(e) =>
                          updateEntry(entry.username, { notes: e.target.value })
                        }
                        placeholder="Add note…"
                        className="w-full min-w-[100px] rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-white/25 outline-none"
                      />
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page}
        pageSize={pageSize}
        total={displayRows.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}
