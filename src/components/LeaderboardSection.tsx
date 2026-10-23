"use client";

import { useState } from "react";
import type { AccountLeaderboard, AccountLeaderboardEntry } from "@/types/insights";
import { AccountSourcesPopover } from "@/components/AccountSourcesPopover";
import { Avatar } from "@/components/ig/Avatar";
import { redactNameLabel } from "@/lib/dmDisplayLabels";
import { formatNumber } from "@/lib/formatters";
import { usePresentationMode } from "@/contexts/PresentationContext";

const PREVIEW_COUNT = 3;
const EXPANDED_BATCH = 25;

const MEDALS = ["🥇", "🥈", "🥉"];

function scoreHint(boardId: string, entry: AccountLeaderboardEntry): string | null {
  if (boardId === "top-dm" && entry.dmCount > 0) {
    return entry.dmCount === 1 ? "1 message" : `${formatNumber(entry.dmCount)} messages`;
  }
  if (boardId === "top-group" && (entry.groupDmCount ?? 0) > 0) {
    return `${formatNumber(entry.groupDmCount ?? 0)} sent in groups`;
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

export function LeaderboardSection({ board, onOpenAccount }: LeaderboardSectionProps) {
  const { presentationMode } = usePresentationMode();
  const showNames = !presentationMode;
  const [visibleCount, setVisibleCount] = useState(PREVIEW_COUNT);
  const rows = board.entries.slice(0, visibleCount);

  return (
    <section className="rounded-xl border border-ig-border">
      <header className="border-b border-ig-border px-4 py-3">
        <h3 className="text-base font-semibold">{board.title}</h3>
        {board.sourceNote && <p className="mt-0.5 text-xs text-ig-muted">{board.sourceNote}</p>}
      </header>

      {rows.length === 0 ? (
        <p className="px-4 py-4 text-sm text-ig-muted">
          {board.emptyReason ?? "Not enough data in this export for this leaderboard."}
        </p>
      ) : (
        <ol className="px-4 py-1">
          {rows.map((entry, i) => {
            const hint = scoreHint(board.id, entry);
            return (
              <li key={entry.username} className="flex items-center gap-3 py-2.5">
                <span className="w-6 shrink-0 text-center text-sm tabular-nums text-ig-muted">
                  {MEDALS[i] ?? i + 1}
                </span>
                <Avatar size={36} />
                <button
                  type="button"
                  onClick={() => onOpenAccount?.(entry.username)}
                  disabled={!showNames || !onOpenAccount}
                  className="min-w-0 flex-1 text-left leading-tight disabled:cursor-default"
                >
                  <span className="block truncate text-sm font-semibold">
                    {redactNameLabel(entry.displayName, showNames)}
                  </span>
                  {hint && <span className="block text-xs text-ig-muted">{hint}</span>}
                </button>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{formatNumber(entry.score)}</span>
                <AccountSourcesPopover breakdown={entry.sourceBreakdown} compact />
              </li>
            );
          })}
        </ol>
      )}

      {board.entries.length > PREVIEW_COUNT && (
        <div className="border-t border-ig-border px-4 py-2.5 text-center">
          {visibleCount < board.entries.length ? (
            <button
              type="button"
              onClick={() =>
                setVisibleCount((n) =>
                  Math.min(n === PREVIEW_COUNT ? EXPANDED_BATCH : n + EXPANDED_BATCH, board.entries.length)
                )
              }
              className="text-sm font-semibold text-ig-blue hover:text-ig-link"
            >
              {visibleCount === PREVIEW_COUNT
                ? "See full leaderboard"
                : `Show ${formatNumber(Math.min(EXPANDED_BATCH, board.entries.length - visibleCount))} more`}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setVisibleCount(PREVIEW_COUNT)}
              className="text-sm font-semibold text-ig-muted hover:text-fg"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </section>
  );
}
