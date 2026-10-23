"use client";

import { useState } from "react";
import { EyeOff, Lock, Search } from "lucide-react";
import type { InsightsBundle, SearchWrappedEntry } from "@/types/insights";
import { Avatar } from "@/components/ig/Avatar";
import { formatTimestamp } from "@/lib/formatters";
import { plural } from "@/lib/profileOwner";

interface SearchWrappedTabProps {
  insights: InsightsBundle | null;
  hidden?: boolean;
}

// Rendered instead of the stored privacyNote: older saved snapshots carry outdated wording.
const SEARCH_PRIVACY_NOTE =
  "Instagram's export may only include search history retained in this download. Cloud saves keep only your top searches and counts (up to 15 each), not the full history.";

type ListId = "accounts" | "terms" | "repeated";

/** Your Instagram search history, laid out like Instagram's search panel. */
export function SearchWrappedTab({ insights, hidden = false }: SearchWrappedTabProps) {
  const [unlocked, setUnlocked] = useState(false);
  const [list, setList] = useState<ListId>("accounts");
  const [query, setQuery] = useState("");
  const search = insights?.searchWrapped;

  if (hidden) {
    return (
      <Empty icon={EyeOff} title="Hidden while presenting" text="Turn off presentation mode in More to see your searches." />
    );
  }

  if (!search) {
    return (
      <Empty
        icon={Search}
        title="No search history"
        text="Instagram didn't include search history in this export, or it wasn't in your download selection."
      />
    );
  }

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-sm py-12 text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-fg">
          <Lock className="h-9 w-9" strokeWidth={1.5} />
        </span>
        <p className="mt-4 text-xl">Your searches are private</p>
        <p className="mt-2 text-sm text-ig-muted">
          Search history can be very personal — only open it if you&apos;re comfortable. A cloud save
          keeps just your top 15 accounts and terms with their counts.
        </p>
        <button
          type="button"
          onClick={() => setUnlocked(true)}
          className="mt-5 rounded-lg bg-ig-blue px-5 py-2 text-sm font-semibold text-white hover:bg-ig-blue-hover"
        >
          Show my searches
        </button>
      </div>
    );
  }

  const lists: { id: ListId; label: string; items: SearchWrappedEntry[] }[] = [
    { id: "accounts", label: "Accounts", items: search.topAccounts },
    { id: "terms", label: "Terms", items: search.topTerms },
    { id: "repeated", label: "On repeat", items: search.repeatedSearches },
  ];
  const current = lists.find((l) => l.id === list) ?? lists[0];
  const q = query.trim().toLowerCase();
  const items = q ? current.items.filter((i) => i.query.toLowerCase().includes(q)) : current.items;
  const peakMonth = [...(search.searchTimeline ?? [])].sort((a, b) => b.count - a.count)[0];

  return (
    <div className="mx-auto max-w-[614px]">
      <label className="relative flex items-center">
        <span className="sr-only">Filter your searches</span>
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-ig-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your searches"
          className="h-10 w-full rounded-lg bg-ig-secondary pl-10 pr-3 text-sm outline-none placeholder:text-ig-muted"
        />
      </label>

      <p className="mt-4 text-sm">
        <span className="font-semibold">{plural(search.totalSearches, "search", "searches")}</span>
        {peakMonth && <span className="text-ig-muted"> · busiest month {peakMonth.month}</span>}
      </p>
      {search.labels.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {search.labels.map((label) => (
            <li key={label} className="rounded-lg bg-ig-secondary px-3 py-1.5 text-sm font-semibold">
              {label}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex border-b border-ig-border" role="tablist" aria-label="Search lists">
        {lists.map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={l.id === list}
            onClick={() => setList(l.id)}
            className={`-mb-px flex-1 border-b py-3 text-sm font-semibold ${
              l.id === list ? "border-fg text-fg" : "border-transparent text-ig-muted hover:text-fg"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <ul className="py-2">
        {items.map((item) => (
          <li key={item.query} className="flex items-center gap-3 py-2">
            {item.type === "account" ? (
              <Avatar size={44} />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ig-border">
                <Search className="h-5 w-5" />
              </span>
            )}
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold">{item.query}</p>
              <p className="truncate text-xs text-ig-muted">
                Searched {plural(item.count, "time")}
                {item.lastSearchedAt ? ` · last on ${formatTimestamp(item.lastSearchedAt)}` : ""}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-ig-muted">×{item.count}</span>
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-12 text-center text-sm text-ig-muted">{q ? "No matches." : "Nothing here yet."}</li>
        )}
      </ul>

      <p className="mt-4 text-xs text-ig-muted">{SEARCH_PRIVACY_NOTE}</p>
    </div>
  );
}

function Empty({ icon: Icon, title, text }: { icon: typeof Search; title: string; text: string }) {
  return (
    <div className="py-16 text-center">
      <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-fg">
        <Icon className="h-9 w-9" strokeWidth={1.5} />
      </span>
      <p className="mt-4 text-xl">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ig-muted">{text}</p>
    </div>
  );
}
