"use client";

import { useEffect, useMemo, useState } from "react";
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
import { exportLinkedInHelperCsv } from "@/lib/exportCsv";
import { linkedInSearchUrl, instagramProfileUrl } from "@/lib/formatters";
import {
  getAccountsForLinkedInSource,
  mergeAccountsToLinkedInEntries,
} from "@/lib/networkAccountDetail";
import {
  loadLinkedInProgress,
  saveLinkedInProgress,
  clearLinkedInProgress,
} from "@/lib/linkedinStorage";
import { TablePagination, paginate } from "@/components/TablePagination";
import {
  AccountDetailDrawer,
  useAccountDetail,
} from "@/components/AccountDetailDrawer";

interface LinkedInHelperTabProps {
  network: NetworkStats | null;
  fingerprint: string;
  entries: LinkedInHelperEntry[];
  onEntriesChange: (entries: LinkedInHelperEntry[]) => void;
}

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

export function LinkedInHelperTab({
  network,
  fingerprint,
  entries,
  onEntriesChange,
}: LinkedInHelperTabProps) {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<LinkedInSource>("all");
  const [statusFilter, setStatusFilter] = useState<LinkedInStatus | "all">(
    "all"
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [initialized, setInitialized] = useState(false);
  const accountDetail = useAccountDetail();

  const sourceAccounts = useMemo(() => {
    if (!network) return [];
    return getAccountsForLinkedInSource(network, source);
  }, [network, source]);

  useEffect(() => {
    if (!network || !fingerprint || initialized) return;
    const stored = loadLinkedInProgress(fingerprint);
    const allAccounts = getAccountsForLinkedInSource(network, "all");
    const merged = mergeAccountsToLinkedInEntries(allAccounts, stored);
    onEntriesChange(merged);
    setInitialized(true);
  }, [network, fingerprint, initialized, onEntriesChange]);

  useEffect(() => {
    if (!fingerprint || entries.length === 0) return;
    saveLinkedInProgress(fingerprint, entries);
  }, [entries, fingerprint]);

  useEffect(() => {
    setPage(1);
  }, [search, source, statusFilter]);

  const displayEntries = useMemo(() => {
    const entryMap = new Map(entries.map((e) => [e.username, e]));
    const q = search.trim().toLowerCase();

    return sourceAccounts
      .map(
        (a) =>
          entryMap.get(a.username) ?? {
            username: a.username,
            displayUsername: a.displayUsername,
            instagramHref: a.href ?? instagramProfileUrl(a.username),
            status: "not-reviewed" as LinkedInStatus,
            notes: "",
            category: a.category,
          }
      )
      .filter((e) => {
        if (statusFilter !== "all" && e.status !== statusFilter) return false;
        if (!q) return true;
        return (
          e.username.includes(q) ||
          e.displayUsername.toLowerCase().includes(q) ||
          (e.category?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => a.displayUsername.localeCompare(b.displayUsername));
  }, [entries, sourceAccounts, search, statusFilter]);

  const pagedEntries = paginate(displayEntries, page, pageSize);

  const updateEntry = (
    username: string,
    patch: Partial<LinkedInHelperEntry>
  ) => {
    const map = new Map(entries.map((e) => [e.username, e]));
    const existing = map.get(username) ?? {
      username,
      displayUsername: username,
      status: "not-reviewed" as LinkedInStatus,
      notes: "",
    };
    map.set(username, { ...existing, ...patch });
    onEntriesChange(Array.from(map.values()));
  };

  const handleClearLocal = () => {
    if (!fingerprint || !network) return;
    if (!confirm("Clear all local LinkedIn Helper progress for this export?")) {
      return;
    }
    clearLinkedInProgress(fingerprint);
    const allAccounts = getAccountsForLinkedInSource(network, "all");
    onEntriesChange(mergeAccountsToLinkedInEntries(allAccounts, null));
  };

  const linkedinForSelected = entries.find(
    (e) => e.username === accountDetail.selectedUsername
  );

  if (!network) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
        <Briefcase className="mx-auto h-10 w-10 text-white/20" />
        <h3 className="mt-4 text-lg font-semibold text-white">
          Network data required
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
          Upload an export with followers/following data to use the LinkedIn
          Helper.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AccountDetailDrawer
        open={accountDetail.isOpen}
        onClose={accountDetail.closeAccount}
        username={accountDetail.selectedUsername}
        network={network}
        linkedinEntry={linkedinForSelected}
      />

      <div className="rounded-2xl border border-[#515BD4]/20 bg-[#515BD4]/10 p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 text-[#818cf8]" />
          <div>
            <p className="text-sm font-medium text-white/90">
              Manual networking helper
            </p>
            <p className="mt-1 text-xs text-white/50">
              Google search links only — no scraping or automation. All{" "}
              {getAccountsForLinkedInSource(network, "all").length.toLocaleString()}{" "}
              network accounts available with pagination.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSource(opt.value)}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                source === opt.value
                  ? "bg-white/10 text-white border border-white/15"
                  : "text-white/45 hover:text-white/70 border border-transparent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as LinkedInStatus | "all")
            }
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none"
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search username, display name, category…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#515BD4]/40"
            />
          </div>
          <button
            type="button"
            onClick={() => exportLinkedInHelperCsv(entries, "linkedin-helper.csv")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10"
          >
            <Download className="h-3.5 w-3.5" />
            Export all CSV
          </button>
          <button
            type="button"
            onClick={handleClearLocal}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white/50 hover:bg-white/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear local progress
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Instagram</th>
                <th className="px-4 py-3">LinkedIn</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {pagedEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-white/40">
                    No accounts match your filters.
                  </td>
                </tr>
              ) : (
                pagedEntries.map((entry) => (
                  <tr
                    key={entry.username}
                    className="border-b border-white/5 hover:bg-white/[0.03]"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => accountDetail.openAccount(entry.username)}
                        className="font-medium text-white hover:text-[#DD2A7B]"
                      >
                        @{entry.displayUsername}
                      </button>
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-xs capitalize text-white/45">
                      {entry.category ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={entry.instagramHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#DD2A7B] hover:underline"
                      >
                        IG <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={linkedInSearchUrl(entry.displayUsername)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-[#515BD4]/30 bg-[#515BD4]/10 px-2 py-1 text-xs text-[#818cf8] hover:bg-[#515BD4]/20"
                      >
                        <Briefcase className="h-3 w-3" />
                        Search
                      </a>
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
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          total={displayEntries.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
}
