"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AccountLeaderboard, AccountLeaderboardEntry } from "@/types/insights";
import { AccountSourcesPopover } from "@/components/AccountSourcesPopover";
import { ConfidencePill } from "@/components/ConfidencePill";
import { formatAccountDisplayName } from "@/lib/accountNameFilter";
import { formatNumber } from "@/lib/formatters";

const PREVIEW_COUNT = 3;
const EXPANDED_BATCH = 25;

const PODIUM_EMOJI: Record<1 | 2 | 3, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

function boardConfidence(
  boardId: string
): "high" | "medium" | "low" {
  if (boardId === "top-dm" || boardId === "top-group" || boardId === "top-liked") {
    return "high";
  }
  if (boardId === "silent-mutuals") return "medium";
  return "medium";
}

const PODIUM_STYLES: Record<
  1 | 2 | 3,
  { row: string; badge: string; label: string }
> = {
  1: {
    row: "border-amber-400/35 bg-gradient-to-r from-amber-500/12 via-amber-500/5 to-transparent shadow-[inset_3px_0_0_rgba(251,191,36,0.65)]",
    badge: "bg-amber-500/20 text-amber-200 border-amber-400/40",
    label: "1st",
  },
  2: {
    row: "border-slate-300/25 bg-gradient-to-r from-slate-400/10 via-white/[0.03] to-transparent shadow-[inset_3px_0_0_rgba(203,213,225,0.45)]",
    badge: "bg-slate-400/15 text-slate-200 border-slate-300/30",
    label: "2nd",
  },
  3: {
    row: "border-orange-600/30 bg-gradient-to-r from-orange-700/12 via-orange-900/5 to-transparent shadow-[inset_3px_0_0_rgba(180,83,9,0.5)]",
    badge: "bg-orange-800/25 text-orange-200 border-orange-600/35",
    label: "3rd",
  },
};

function scoreHint(boardId: string, entry: AccountLeaderboardEntry): string | null {
  if (boardId === "top-dm" && entry.dmCount > 0) {
    return `${formatNumber(entry.dmCount)} msgs`;
  }
  if (boardId === "top-group" && (entry.groupDmCount ?? 0) > 0) {
    return `${formatNumber(entry.groupDmCount ?? 0)} sent`;
  }
  if (boardId === "top-liked" && (entry.likeCount ?? 0) > 0) {
    return `${formatNumber(entry.likeCount ?? 0)} likes`;
  }
  return null;
}

interface LeaderboardSectionProps {
  board: AccountLeaderboard;
  onOpenAccount?: (username: string) => void;
}

export function LeaderboardSection({
  board,
  onOpenAccount,
}: LeaderboardSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(EXPANDED_BATCH);

  const hasData = board.entries.length > 0;
  const preview = board.entries.slice(0, PREVIEW_COUNT);
  const expandedSlice = board.entries.slice(
    0,
    expanded ? visibleCount : PREVIEW_COUNT
  );
  const rows = expanded ? expandedSlice : preview;
  const canExpand = board.entries.length > PREVIEW_COUNT;
  const hasMore =
    expanded && visibleCount < board.entries.length;

  if (!hasData) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
        <h4 className="text-sm font-semibold text-white/80">{board.title}</h4>
        {board.sourceNote && (
          <p className="mt-0.5 text-[11px] leading-snug text-white/35">
            {board.sourceNote}
          </p>
        )}
        <p className="mt-2 text-xs text-white/40">
          {board.emptyReason ??
            "Not enough data in this export for this leaderboard."}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold text-white">{board.title}</h4>
          <ConfidencePill level={boardConfidence(board.id)} />
        </div>
        {board.sourceNote && (
          <p className="mt-1 text-[11px] leading-snug text-white/40">
            {board.sourceNote}
          </p>
        )}
      </div>

      <ul className="mt-3 flex-1 space-y-1.5">
        {rows.map((entry, i) => {
          const rank = i + 1;
          const isPodium = rank <= 3;
          const podium = isPodium ? PODIUM_STYLES[rank as 1 | 2 | 3] : null;
          const hint = scoreHint(board.id, entry);

          return (
            <li
              key={entry.username}
              className={
                isPodium && podium
                  ? `flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${podium.row}`
                  : "flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
              }
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                {isPodium && podium ? (
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-sm ${podium.badge}`}
                    title={podium.label}
                  >
                    {PODIUM_EMOJI[rank as 1 | 2 | 3]}
                  </span>
                ) : (
                  <span className="w-7 shrink-0 text-center text-xs tabular-nums text-white/35">
                    #{rank}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onOpenAccount?.(entry.username)}
                  className={`min-w-0 flex-1 text-left hover:text-[#DD2A7B] ${
                    isPodium ? "text-sm font-semibold text-white" : "text-sm text-white/80"
                  }`}
                >
                  {formatAccountDisplayName(entry.displayName)}
                  {hint && (
                    <span className="ml-1.5 text-xs font-normal text-white/40">
                      · {hint}
                    </span>
                  )}
                </button>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span
                  className={`tabular-nums ${
                    isPodium ? "text-sm font-semibold text-white" : "text-xs text-white/45"
                  }`}
                >
                  {formatNumber(entry.score)}
                </span>
                <AccountSourcesPopover breakdown={entry.sourceBreakdown} compact />
              </div>
            </li>
          );
        })}
      </ul>

      {canExpand && (
        <div className="mt-3 space-y-2 border-t border-white/8 pt-3">
          <button
            type="button"
            onClick={() => {
              if (expanded) {
                setExpanded(false);
                setVisibleCount(EXPANDED_BATCH);
              } else {
                setExpanded(true);
              }
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] py-2 text-xs font-medium text-white/55 transition hover:bg-white/[0.06] hover:text-white/75"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition ${expanded ? "rotate-180" : ""}`}
            />
            {expanded ? "Collapse leaderboard" : "Show full leaderboard"}
          </button>
          {hasMore && (
            <button
              type="button"
              onClick={() =>
                setVisibleCount((n) =>
                  Math.min(n + EXPANDED_BATCH, board.entries.length)
                )
              }
              className="w-full text-center text-[11px] text-[#DD2A7B]/90 hover:underline"
            >
              Show more ({board.entries.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
