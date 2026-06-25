"use client";

import { useState } from "react";
import { Info, ChevronDown } from "lucide-react";
import type { AccountSourceBreakdown } from "@/types/insights";
import { formatTimestamp } from "@/lib/formatters";

interface AccountSourcesPopoverProps {
  breakdown?: AccountSourceBreakdown;
  compact?: boolean;
}

export function AccountSourcesPopover({
  breakdown,
  compact,
}: AccountSourcesPopoverProps) {
  const [open, setOpen] = useState(false);
  if (!breakdown) return null;

  const confidenceColor =
    breakdown.confidence === "high"
      ? "text-emerald-400"
      : breakdown.confidence === "medium"
        ? "text-amber-300"
        : "text-white/45";

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 ${
          compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
        }`}
      >
        <Info className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
        Sources
        <ChevronDown
          className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-xl border border-white/10 bg-[#0a0a12]/98 p-3 text-xs shadow-xl backdrop-blur-xl">
          <p className={`font-semibold ${confidenceColor}`}>
            Confidence: {breakdown.confidence}
          </p>
          <ul className="mt-2 space-y-1 text-white/55">
            <li>Direct DMs: {breakdown.directDmMessages.toLocaleString()}</li>
            <li>Group msgs sent: {breakdown.groupMessagesSent.toLocaleString()}</li>
            {breakdown.isMutual && <li>Mutual follow</li>}
            {breakdown.likedCount > 0 && (
              <li>Likes: {breakdown.likedCount}</li>
            )}
            {breakdown.commentedCount > 0 && (
              <li>Comments: {breakdown.commentedCount}</li>
            )}
            {breakdown.lastDirectDmAt && (
              <li>Last DM: {formatTimestamp(breakdown.lastDirectDmAt)}</li>
            )}
          </ul>
          {breakdown.explanations.length > 0 && (
            <ul className="mt-2 space-y-0.5 border-t border-white/8 pt-2 text-white/40">
              {breakdown.explanations.map((e) => (
                <li key={e}>· {e}</li>
              ))}
            </ul>
          )}
          {breakdown.isUnknownAccount && (
            <p className="mt-2 text-[10px] leading-relaxed text-amber-200/70">
              Instagram export did not include a stable name for this account.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
