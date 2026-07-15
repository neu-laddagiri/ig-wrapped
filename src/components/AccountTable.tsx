"use client";

import { useMemo, useState } from "react";
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

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: SortField;
  sortField: SortField;
  sortDir: SortDirection;
}) {
  if (sortField !== field) {
    return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
  }
  return sortDir === "asc" ? (
    <ArrowUp className="h-3.5 w-3.5" />
  ) : (
    <ArrowDown className="h-3.5 w-3.5" />
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
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("username");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [copied, setCopied] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = accounts;
    if (q) {
      list = accounts.filter(
        (a) =>
          a.username.includes(q) ||
          a.displayUsername.toLowerCase().includes(q) ||
          (a.category?.toLowerCase().includes(q) ?? false)
      );
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "username") {
        cmp = a.displayUsername.localeCompare(b.displayUsername);
      } else {
        const ta = a.timestamp ?? 0;
        const tb = b.timestamp ?? 0;
        cmp = ta - tb;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [accounts, search, sortField, sortDir]);

  const usePagination = enablePagination && filtered.length > 25;
  const displayed = usePagination
    ? paginate(filtered, page, pageSize)
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
            {search.trim()
              ? `${filtered.length.toLocaleString()} of ${accounts.length.toLocaleString()} matching search`
              : `${accounts.length.toLocaleString()} accounts`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search usernames…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#DD2A7B]/40 sm:w-56"
            />
          </div>
          <button
            type="button"
            onClick={() => exportAccountsCsv(accounts, exportFilename)}
            disabled={accounts.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10 disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
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
                    <SortIcon
                      field="username"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
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
                    <SortIcon
                      field="timestamp"
                      sortField={sortField}
                      sortDir={sortDir}
                    />
                  </button>
                </th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((account) => (
                <tr
                  key={`${account.username}-${account.category}`}
                  className="border-b border-white/5 transition hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3">
                    {onAccountClick ? (
                      <button
                        type="button"
                        onClick={() => onAccountClick(account)}
                        className="font-medium text-white hover:text-[#DD2A7B]"
                      >
                        @{account.displayUsername}
                      </button>
                    ) : (
                      <a
                        href={
                          account.href ?? instagramProfileUrl(account.username)
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-white hover:text-[#DD2A7B]"
                      >
                        @{account.displayUsername}
                      </a>
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
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => copyUsername(account.displayUsername)}
                        title="Copy username"
                        className="rounded-lg p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
                      >
                        {copied === account.displayUsername ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <a
                        href={
                          account.href ?? instagramProfileUrl(account.username)
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open Instagram"
                        className="rounded-lg p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <a
                        href={linkedInSearchUrl(
                          account.username,
                          account.displayUsername
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Search LinkedIn on Google"
                        className="rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/50 transition hover:bg-white/10 hover:text-[#515BD4]"
                      >
                        LI
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {usePagination && (
        <TablePagination
          total={filtered.length}
          page={page}
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
