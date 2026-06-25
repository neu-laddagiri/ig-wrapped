"use client";

import { useState } from "react";
import { Search, AlertTriangle } from "lucide-react";
import type { InsightsBundle } from "@/types/insights";

interface SearchWrappedTabProps {
  insights: InsightsBundle | null;
  hidden?: boolean;
}

export function SearchWrappedTab({ insights, hidden = false }: SearchWrappedTabProps) {
  const [unlocked, setUnlocked] = useState(false);
  const search = insights?.searchWrapped;

  if (hidden) {
    return (
      <div className="rounded-2xl border border-[#515BD4]/25 bg-[#515BD4]/10 px-6 py-12 text-center">
        <p className="text-sm text-white/55">
          Search history is hidden in Presentation Mode. Turn off Presentation
          Mode to view search details.
        </p>
      </div>
    );
  }

  if (!search) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
        <Search className="mx-auto h-10 w-10 text-white/20" />
        <p className="mx-auto mt-4 max-w-md text-sm text-white/45">
          No search history found in this export. Instagram may not have
          included it, or it was not in your download selection.
        </p>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" />
          <div>
            <h3 className="font-semibold text-amber-50">Search history is sensitive</h3>
            <p className="mt-2 text-sm text-amber-100/80">
              Search history can be extremely private. Only open this section if
              you are comfortable viewing it. Raw search text is not saved to
              cloud — only parsed summaries when you save your analysis.
            </p>
            <button
              type="button"
              onClick={() => setUnlocked(true)}
              className="mt-4 rounded-full animated-gradient-bg px-5 py-2 text-sm font-semibold text-white"
            >
              I understand — show search wrapped
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <p className="text-sm text-white/50">
          {search.totalSearches.toLocaleString()} searches · parsed{" "}
          {search.filesParsed?.length ?? 0} search file
          {(search.filesParsed?.length ?? 0) === 1 ? "" : "s"}
        </p>
        <p className="mt-2 text-xs text-white/40">{search.privacyNote}</p>
        {search.labels.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {search.labels.map((l) => (
              <span
                key={l}
                className="rounded-full border border-[#DD2A7B]/30 bg-[#DD2A7B]/10 px-3 py-1 text-xs text-[#DD2A7B]"
              >
                {l}
              </span>
            ))}
          </div>
        )}
      </div>

      <SearchList title="Most searched accounts" items={search.topAccounts} />
      <SearchList title="Most searched terms" items={search.topTerms} />
      <SearchList title="Repeated searches" items={search.repeatedSearches} />

      {search.searchTimeline && search.searchTimeline.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h4 className="font-semibold text-white">Search timeline</h4>
          <ul className="mt-3 space-y-1.5">
            {search.searchTimeline.slice(-12).map((row) => (
              <li
                key={row.month}
                className="flex justify-between text-sm text-white/60"
              >
                <span>{row.month}</span>
                <span>{row.count} searches</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {search.filesParsed && search.filesParsed.length > 0 && (
        <p className="text-xs text-white/35">
          Parsed from {search.filesParsed.length} file(s). See Data Explorer for
          paths.
        </p>
      )}

      <p className="text-xs text-white/35">{search.privacyNote}</p>
    </div>
  );
}

function SearchList({
  title,
  items,
}: {
  title: string;
  items: { query: string; count: number }[];
}) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h4 className="font-semibold text-white">{title}</h4>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item.query}
            className="flex justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm"
          >
            <span className="text-white/75">{item.query}</span>
            <span className="text-white/40">{item.count}×</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
