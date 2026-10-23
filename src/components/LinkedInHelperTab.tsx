"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
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
import {
  isLikelyInstagramUsername,
  isSyntheticCanonicalKey,
  normalizeUsername,
} from "@/lib/accountIdentity";
import { getAccountsForLinkedInSource } from "@/lib/networkAccountDetail";
import { redactNameLabel } from "@/lib/dmDisplayLabels";
import { usePresentationMode } from "@/contexts/PresentationContext";
import {
  loadLinkedInProgress,
  saveLinkedInProgress,
  clearLinkedInProgress,
} from "@/lib/linkedinStorage";
import { exportLinkedInHelperCsv } from "@/lib/exportCsv";
import {
  buildLinkedInSearchQuery,
  openLinkedInGoogleSearch,
} from "@/lib/linkedinSearchQuery";
import type { LinkedInSearchContext } from "@/lib/linkedinSearchQuery";
import { TablePagination, paginate } from "@/components/TablePagination";

interface LinkedInHelperTabProps {
  network: NetworkStats | null;
  fingerprint: string;
  canonicalAccounts: CanonicalAccount[];
  directDmIndex: DirectDmIndex;
  entries: LinkedInHelperEntry[];
  onEntriesChange: Dispatch<SetStateAction<LinkedInHelperEntry[]>>;
  onOpenAccount: (target: AccountReceiptTarget) => void;
  schoolContext?: string;
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

const VALID_STATUSES = new Set<LinkedInStatus>(
  STATUS_OPTIONS.map((opt) => opt.value)
);

function stopRowClick(e: React.SyntheticEvent) {
  e.stopPropagation();
}

/** Stored progress may predate the current shape — fill required fields. */
function sanitizeStoredEntries(stored: unknown[]): LinkedInHelperEntry[] {
  const out: LinkedInHelperEntry[] = [];
  for (const raw of stored) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Partial<LinkedInHelperEntry>;
    if (typeof e.username !== "string" || !e.username.trim()) continue;
    out.push({
      ...e,
      username: e.username,
      displayUsername:
        typeof e.displayUsername === "string" ? e.displayUsername : e.username,
      status: e.status && VALID_STATUSES.has(e.status) ? e.status : "not-reviewed",
      notes: typeof e.notes === "string" ? e.notes : "",
    });
  }
  return out;
}

/** Real profile links only — never for synthetic account keys or "#". */
function safeInstagramHref(href?: string): string | null {
  const match = href?.match(/^https:\/\/(?:www\.)?instagram\.com\/([^/?#]+)\/?$/i);
  if (!href || !match) return null;
  let handle: string;
  try {
    handle = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return isSyntheticCanonicalKey(handle) || !isLikelyInstagramUsername(handle)
    ? null
    : href;
}

export function LinkedInHelperTab({
  network,
  fingerprint,
  canonicalAccounts,
  directDmIndex,
  entries,
  onEntriesChange,
  onOpenAccount,
  schoolContext,
}: LinkedInHelperTabProps) {
  const linkedInSearchContext = useMemo((): LinkedInSearchContext | undefined => {
    const school = schoolContext?.trim();
    return school ? { school } : undefined;
  }, [schoolContext]);
  const { presentationMode } = usePresentationMode();
  const showNames = !presentationMode;
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [source, setSource] = useState<LinkedInSource>("all");
  const [sortMode, setSortMode] = useState<SortMode>("most-interacted");
  const [interactionFilter, setInteractionFilter] =
    useState<InteractionFilter>("hide-unknown");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const hydratedRef = useRef(false);
  const mountEntriesRef = useRef(entries);
  const pendingSaveRef = useRef<LinkedInHelperEntry[] | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const entryByKey = useMemo(() => {
    const map = new Map<string, LinkedInHelperEntry>();
    for (const entry of entries) {
      if (typeof entry.username !== "string") continue;
      map.set(entry.username, entry);
      map.set(normalizeUsername(entry.username), entry);
    }
    return map;
  }, [entries]);

  const sourceAccounts = useMemo(() => {
    if (!network) return [];
    return getAccountsForLinkedInSource(network, source);
  }, [network, source]);

  // Hydrate from localStorage once, and only when nothing is in memory —
  // in-memory progress (edits, cloud loads) is always newer than storage.
  useEffect(() => {
    if (hydratedRef.current || !fingerprint) return;
    hydratedRef.current = true;
    if (entries.length > 0) return;
    const stored = loadLinkedInProgress(fingerprint);
    if (stored?.length) onEntriesChange(sanitizeStoredEntries(stored));
  }, [fingerprint, entries.length, onEntriesChange]);

  useEffect(() => {
    if (!fingerprint || entries === mountEntriesRef.current) return;
    pendingSaveRef.current = entries;
    const timer = window.setTimeout(() => {
      saveLinkedInProgress(fingerprint, entries);
      pendingSaveRef.current = null;
    }, 400);
    return () => window.clearTimeout(timer);
  }, [entries, fingerprint]);

  // Flush a debounced save when the tab unmounts (e.g. switching tabs).
  useEffect(() => {
    const pending = pendingSaveRef;
    return () => {
      if (pending.current && fingerprint) {
        saveLinkedInProgress(fingerprint, pending.current);
        pending.current = null;
      }
    };
  }, [fingerprint]);

  const baseRows = useMemo(
    () =>
      buildLinkedInHelperRows({
        directDmIndex,
        canonicalAccounts,
        sourceAccounts,
        source,
        entryByKey,
      }),
    [
      directDmIndex,
      canonicalAccounts,
      sourceAccounts,
      source,
      entryByKey,
    ]
  );

  const activeQuery = showNames ? debouncedSearch.trim().toLowerCase() : "";

  const displayRows = useMemo(() => {
    const q = activeQuery;

    const filtered = baseRows.filter((row) => {
      const {
        entry,
        directDmCount,
        isMutual,
        isUnknown,
        isSilentMutual,
        followsMe,
        iFollowThem,
        displayLabel,
        secondaryLabel,
      } = row;

      if (
        q &&
        !entry.username.toLowerCase().includes(q) &&
        !(entry.displayUsername ?? "").toLowerCase().includes(q) &&
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
        !(iFollowThem && !followsMe)
      ) {
        return false;
      }
      if (
        interactionFilter === "i-dont-follow-back" &&
        !(followsMe && !iFollowThem)
      ) {
        return false;
      }
      if (
        interactionFilter === "not-reviewed" &&
        entry.status !== "not-reviewed"
      ) {
        return false;
      }
      if (interactionFilter === "has-notes" && !(entry.notes ?? "").trim()) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((a, b) => compareLinkedInRows(a, b, sortMode));
  }, [baseRows, activeQuery, interactionFilter, sortMode]);

  const totalPages = Math.max(1, Math.ceil(displayRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pagedRows = useMemo(
    () => paginate(displayRows, currentPage, pageSize),
    [displayRows, currentPage, pageSize]
  );

  const updateEntry = useCallback(
    (
      progressKey: string,
      patch: Partial<LinkedInHelperEntry>,
      baseEntry: LinkedInHelperEntry
    ) => {
      onEntriesChange((prev) => {
        const existing = prev.find((e) => e.username === progressKey);
        if (existing) {
          return prev.map((e) =>
            e.username === progressKey ? { ...e, ...patch } : e
          );
        }

        const legacy = prev.find(
          (e) =>
            e.username !== progressKey &&
            (e.username === baseEntry.username ||
              normalizeUsername(e.username) ===
                normalizeUsername(baseEntry.username))
        );
        if (legacy) {
          return prev.map((e) =>
            e === legacy
              ? { ...baseEntry, ...legacy, ...patch, username: progressKey }
              : e
          );
        }

        return [...prev, { ...baseEntry, ...patch, username: progressKey }];
      });
    },
    [onEntriesChange]
  );

  const handleExport = useCallback(() => {
    if (!network) return;
    // Same labels and school context as the in-app Search buttons.
    exportLinkedInHelperCsv(
      displayRows.map(({ entry, displayLabel }) => ({ ...entry, displayLabel })),
      "linkedin-helper.csv",
      linkedInSearchContext
    );
  }, [network, displayRows, linkedInSearchContext]);

  const handleClearProgress = useCallback(() => {
    if (!fingerprint) return;
    if (!confirm("Clear all LinkedIn helper progress for this export?")) return;
    clearLinkedInProgress(fingerprint);
    onEntriesChange([]);
  }, [fingerprint, onEntriesChange]);

  if (!network) {
    return (
      <p className="py-12 text-center text-sm text-ig-muted">
        Upload an export with followers/following data to use LinkedIn helper.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-fg">LinkedIn helper</h2>
          <p className="text-xs text-ig-muted">
            Ranked from the same 1-on-1 DM threads as the DMs tab. Network-only
            accounts appear after everyone you actually DM.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ig-border bg-ig-secondary px-3 py-2 text-xs text-fg hover:bg-ig-hover"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleClearProgress}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-ig-bad hover:bg-red-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear progress
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ig-muted" aria-hidden />
          <input
            type="search"
            aria-label="Search LinkedIn helper accounts"
            value={showNames ? searchInput : ""}
            disabled={!showNames}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            placeholder={
              showNames ? "Search username or name…" : "Search hidden while presenting"
            }
            className="w-full rounded-lg border border-ig-border bg-ig-secondary py-2 pl-9 pr-3 text-sm text-fg placeholder:text-ig-muted outline-none focus:border-ig-muted disabled:opacity-60"
          />
        </div>
        <select
          value={source}
          aria-label="Account source"
          onChange={(e) => {
            setSource(e.target.value as LinkedInSource);
            setPage(1);
          }}
          className="rounded-lg border border-ig-border bg-ig-secondary px-3 py-2 text-sm text-fg outline-none"
        >
          {SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={sortMode}
          aria-label="Sort accounts"
          onChange={(e) => {
            setSortMode(e.target.value as SortMode);
            setPage(1);
          }}
          className="rounded-lg border border-ig-border bg-ig-secondary px-3 py-2 text-sm text-fg outline-none"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Sort: {opt.label}
            </option>
          ))}
        </select>
        <select
          value={interactionFilter}
          aria-label="Filter accounts"
          onChange={(e) => {
            setInteractionFilter(e.target.value as InteractionFilter);
            setPage(1);
          }}
          className="rounded-lg border border-ig-border bg-ig-secondary px-3 py-2 text-sm text-fg outline-none"
        >
          {INTERACTION_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-ig-border bg-ig-secondary px-3 py-2 text-xs text-ig-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg" />
        <p>
          Most interacted: direct DM count → last DM date → mutual / follower /
          following → username. No likes, comments, or fuzzy name matching.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-ig-border">
        <table className="w-full min-w-[720px] table-fixed text-left text-sm">
          <thead>
            <tr className="border-b border-ig-border bg-ig-subtle text-xs uppercase tracking-wider text-ig-muted">
              <th className="w-[22%] px-4 py-3">Account</th>
              <th className="w-[9%] px-4 py-3">Direct DMs</th>
              <th className="w-[22%] px-4 py-3">Why ranked</th>
              <th className="w-[10%] px-4 py-3">Instagram</th>
              <th className="w-[12%] px-4 py-3">LinkedIn</th>
              <th className="w-[12%] px-4 py-3">Status</th>
              <th className="w-[13%] px-4 py-3">Notes</th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-ig-muted"
                >
                  No accounts match your filters.
                </td>
              </tr>
            ) : (
              pagedRows.map((row) => {
                const {
                  entry,
                  accountKey,
                  threadId,
                  displayLabel,
                  secondaryLabel,
                  directDmCount,
                  reason,
                } = row;
                const notes = entry.notes ?? "";
                const searchAccount = {
                  username: isSyntheticCanonicalKey(entry.username)
                    ? undefined
                    : entry.username,
                  displayName: entry.displayUsername,
                  displayLabel,
                };
                const searchQuery = showNames
                  ? buildLinkedInSearchQuery(searchAccount, linkedInSearchContext)
                  : "";
                const igHref = safeInstagramHref(entry.instagramHref);

                return (
                  <tr
                    key={`${accountKey}:${threadId ?? "network"}`}
                    className="cursor-pointer border-b border-ig-border hover:bg-ig-hover"
                    onClick={() => onOpenAccount({ accountKey, threadId })}
                  >
                    <td className="px-4 py-3 align-top">
                      <button
                        type="button"
                        onClick={(e) => {
                          stopRowClick(e);
                          onOpenAccount({ accountKey, threadId });
                        }}
                        className="text-left font-medium text-fg hover:text-ig-muted"
                      >
                        {showNames
                          ? displayLabel
                          : redactNameLabel(displayLabel, false)}
                      </button>
                      {showNames && (
                        <p className="text-[10px] text-ig-muted">
                          {secondaryLabel}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top font-semibold tabular-nums text-fg">
                      {directDmCount > 0
                        ? directDmCount.toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 align-top text-xs leading-snug text-ig-muted">
                      {reason}
                    </td>
                    <td
                      className="px-4 py-3 align-top"
                      onClick={stopRowClick}
                    >
                      {showNames && igHref ? (
                        <a
                          href={igHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={stopRowClick}
                          className="inline-flex items-center gap-1 text-ig-blue hover:underline"
                        >
                          IG profile
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      ) : (
                        <span className="text-xs text-ig-muted">
                          {showNames ? "No profile link" : "Hidden"}
                        </span>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 align-top"
                      onClick={stopRowClick}
                    >
                      {showNames ? (
                        <button
                          type="button"
                          title={searchQuery}
                          onClick={(e) => {
                            stopRowClick(e);
                            openLinkedInGoogleSearch(
                              searchAccount,
                              linkedInSearchContext
                            );
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-ig-border bg-ig-secondary px-2 py-1 text-xs text-fg hover:bg-ig-hover"
                        >
                          <Briefcase className="h-3 w-3" aria-hidden />
                          Search LinkedIn
                        </button>
                      ) : (
                        <span className="text-xs text-ig-muted">Hidden</span>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 align-top"
                      onClick={stopRowClick}
                    >
                      <select
                        value={entry.status}
                        aria-label="LinkedIn status"
                        onClick={stopRowClick}
                        onMouseDown={stopRowClick}
                        onChange={(e) => {
                          stopRowClick(e);
                          updateEntry(
                            accountKey,
                            {
                              status: e.target.value as LinkedInStatus,
                            },
                            entry
                          );
                        }}
                        className="w-full max-w-[140px] rounded-lg border border-ig-border bg-ig-elevated px-2 py-1.5 text-xs text-fg outline-none"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td
                      className="px-4 py-3 align-top"
                      onClick={stopRowClick}
                    >
                      {showNames ? (
                        <input
                          type="text"
                          aria-label="Notes"
                          value={notes}
                          onClick={stopRowClick}
                          onMouseDown={stopRowClick}
                          onFocus={stopRowClick}
                          onKeyDown={stopRowClick}
                          onChange={(e) => {
                            stopRowClick(e);
                            updateEntry(
                              accountKey,
                              { notes: e.target.value },
                              entry
                            );
                          }}
                          placeholder="Add note…"
                          className="w-full min-w-0 rounded-lg border border-ig-border bg-ig-elevated px-2 py-1.5 text-xs text-fg placeholder:text-ig-muted outline-none focus:border-ig-muted"
                        />
                      ) : (
                        <span className="text-xs text-ig-muted">
                          {notes.trim() ? "Hidden" : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={currentPage}
        pageSize={pageSize}
        total={displayRows.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}
