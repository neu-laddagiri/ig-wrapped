"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Copy,
  Download,
  ExternalLink,
  Search,
} from "lucide-react";
import type {
  InstagramAccount,
  PageSize,
  SortDirection,
  SortField,
} from "@/types/instagram";
import { exportAccountsCsv } from "@/lib/exportCsv";
import {
  formatTimestamp,
  instagramProfileUrl,
  linkedInSearchUrl,
} from "@/lib/formatters";
import { isLikelyInstagramUsername } from "@/lib/accountIdentity";
import { redactNameLabel } from "@/lib/dmDisplayLabels";
import { usePresentationMode } from "@/contexts/PresentationContext";
import { TablePagination, paginate } from "@/components/TablePagination";

interface AccountTableProps {
  accounts: InstagramAccount[];
  title: string;
  exportFilename: string;
  emptyMessage?: string;
  showCategory?: boolean;
  onAccountClick?: (account: InstagramAccount) => void;
  enablePagination?: boolean;
}

const collator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  if (!active) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />;
  return direction === "asc" ? (
    <ArrowUp className="h-3.5 w-3.5" aria-hidden />
  ) : (
    <ArrowDown className="h-3.5 w-3.5" aria-hidden />
  );
}

export function AccountTable({
  accounts,
  title,
  exportFilename,
  emptyMessage = "No accounts in this category.",
  showCategory = false,
  onAccountClick,
  enablePagination = true,
}: AccountTableProps) {
  const { presentationMode } = usePresentationMode();
  const showNames = !presentationMode;
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sortField, setSortField] = useState<SortField>("username");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [copied, setCopied] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);

  // Keys are assigned in source order so they stay stable across re-sorts,
  // even when an export (or the demo) lists the same username twice.
  const sorted = useMemo(() => {
    const seen = new Map<string, number>();
    const keyed = accounts.map((account) => {
      const base = `${account.username}|${account.category ?? ""}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      return { account, key: n === 0 ? base : `${base}|${n}` };
    });
    return keyed.sort((a, b) => {
      const cmp =
        sortField === "username"
          ? collator.compare(a.account.displayUsername, b.account.displayUsername)
          : (a.account.timestamp ?? 0) - (b.account.timestamp ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [accounts, sortField, sortDir]);

  const activeQuery = showNames ? deferredSearch.trim().toLowerCase() : "";

  const filtered = useMemo(() => {
    if (!activeQuery) return sorted;
    return sorted.filter(
      ({ account: a }) =>
        a.username.toLowerCase().includes(activeQuery) ||
        a.displayUsername.toLowerCase().includes(activeQuery) ||
        (a.category?.toLowerCase().includes(activeQuery) ?? false)
    );
  }, [sorted, activeQuery]);

  const usePagination = enablePagination && filtered.length > 25;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const displayed = usePagination
    ? paginate(filtered, currentPage, pageSize)
    : filtered;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const copyUsername = async (username: string) => {
    try {
      await navigator.clipboard.writeText(username);
      setCopied(username);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="text-xs text-white/40">
            {activeQuery
              ? `${filtered.length.toLocaleString()} of ${accounts.length.toLocaleString()} matching search`
              : `${accounts.length.toLocaleString()} accounts`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" aria-hidden />
            <input
              type="text"
              aria-label={`Search ${title}`}
              placeholder={showNames ? "Search usernames…" : "Search hidden while presenting"}
              value={showNames ? search : ""}
              disabled={!showNames}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#DD2A7B]/40 disabled:opacity-60 sm:w-56"
            />
          </div>
          <button
            type="button"
            onClick={() => exportAccountsCsv(accounts, exportFilename)}
            disabled={accounts.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            CSV
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-white/40">
          {emptyMessage}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("username")}
                    className="inline-flex items-center gap-1 hover:text-white/70"
                  >
                    Username{" "}
                    <SortIcon active={sortField === "username"} direction={sortDir} />
                  </button>
                </th>
                {showCategory && <th className="px-4 py-3">Category</th>}
                <th className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggleSort("timestamp")}
                    className="inline-flex items-center gap-1 hover:text-white/70"
                  >
                    Follow date{" "}
                    <SortIcon active={sortField === "timestamp"} direction={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map(({ account, key }) => {
                const label = showNames
                  ? `@${account.displayUsername}`
                  : redactNameLabel(account.displayUsername, false);
                const profileHref =
                  account.href && /^https:\/\/(www\.)?instagram\.com\//i.test(account.href)
                    ? account.href
                    : isLikelyInstagramUsername(account.username)
                      ? instagramProfileUrl(account.username)
                      : null;
                return (
                  <tr
                    key={key}
                    className="border-b border-white/5 transition hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3">
                      {onAccountClick ? (
                        <button
                          type="button"
                          onClick={() => onAccountClick(account)}
                          className="font-medium text-white hover:text-[#DD2A7B]"
                        >
                          {label}
                        </button>
                      ) : showNames && profileHref ? (
                        <a
                          href={profileHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-white hover:text-[#DD2A7B]"
                        >
                          {label}
                        </a>
                      ) : (
                        <span className="font-medium text-white">{label}</span>
                      )}
                    </td>
                    {showCategory && (
                      <td className="px-4 py-3 text-white/50 capitalize">
                        {account.category ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-white/50">
                      {formatTimestamp(account.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      {showNames ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => copyUsername(account.displayUsername)}
                            title="Copy username"
                            aria-label={`Copy username ${account.displayUsername}`}
                            className="rounded-lg p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
                          >
                            {copied === account.displayUsername ? (
                              <Check className="h-4 w-4 text-emerald-400" aria-hidden />
                            ) : (
                              <Copy className="h-4 w-4" aria-hidden />
                            )}
                          </button>
                          {profileHref && (
                            <a
                              href={profileHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open Instagram"
                              aria-label={`Open ${account.displayUsername} on Instagram`}
                              className="rounded-lg p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
                            >
                              <ExternalLink className="h-4 w-4" aria-hidden />
                            </a>
                          )}
                          <a
                            href={linkedInSearchUrl(
                              account.username,
                              account.displayUsername
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Search LinkedIn on Google"
                            aria-label={`Search LinkedIn for ${account.displayUsername}`}
                            className="rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/50 transition hover:bg-white/10 hover:text-[#515BD4]"
                          >
                            LI
                          </a>
                        </div>
                      ) : (
                        <p className="text-right text-xs text-white/30">
                          Hidden while presenting
                        </p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {usePagination && (
        <TablePagination
          total={filtered.length}
          page={currentPage}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
