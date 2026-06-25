"use client";

import { useState } from "react";
import { Trophy, ChevronDown } from "lucide-react";
import type { HallOfFameAward } from "@/types/insights";
import { ConfidencePill } from "@/components/ConfidencePill";
import { formatAccountDisplayName } from "@/lib/accountNameFilter";

interface HallOfFameSectionProps {
  awards: HallOfFameAward[];
  showNames?: boolean;
  onOpenAccount?: (username: string) => void;
}

export function HallOfFameSection({
  awards,
  showNames = true,
  onOpenAccount,
}: HallOfFameSectionProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);

  if (!awards.length) return null;

  const visible = showAll ? awards : awards.slice(0, 6);
  const fame = visible.filter((a) => a.category === "fame");
  const shame = visible.filter((a) => a.category === "shame");

  const renderAward = (award: HallOfFameAward, index: number) => {
    const rowKey = `${award.category ?? "award"}-${award.id}-${index}`;
    const isOpen = expanded[rowKey];
    const label = showNames
      ? formatAccountDisplayName(award.winnerLabel)
      : "Hidden for sharing";

    return (
      <div
        key={rowKey}
        className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
      >
        <button
          type="button"
          onClick={() =>
            setExpanded((e) => ({ ...e, [rowKey]: !e[rowKey] }))
          }
          className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-white">{award.title}</p>
            <p
              className={`mt-0.5 truncate text-xs ${
                award.winnerUsername && showNames
                  ? "text-[#DD2A7B] hover:underline"
                  : "text-white/55"
              }`}
              onClick={(e) => {
                if (award.winnerUsername && showNames) {
                  e.stopPropagation();
                  onOpenAccount?.(award.winnerUsername);
                }
              }}
            >
              {label}
            </p>
          </div>
          <ConfidencePill level={award.confidence} />
        </button>
        {isOpen && (
          <p className="border-t border-white/8 px-3 py-2 text-xs text-white/45">
            {award.why}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-[#F58529]" />
        <h3 className="font-semibold text-white">Hall of Fame / Hall of Shame</h3>
      </div>
      <p className="mt-1 text-xs text-white/40">For fun only — tap an award for details.</p>
      {fame.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-400/80">
            Hall of Fame
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {fame.map((award, i) => renderAward(award, i))}
          </div>
        </div>
      )}
      {shame.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-amber-400/80">
            Hall of Shame
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {shame.map((award, i) => renderAward(award, i))}
          </div>
        </div>
      )}
      {awards.length > 6 && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="mt-3 flex w-full items-center justify-center gap-1 text-xs text-white/50 hover:text-white/70"
        >
          <ChevronDown className={`h-3.5 w-3.5 ${showAll ? "rotate-180" : ""}`} />
          {showAll ? "Show less" : `Show all awards (${awards.length})`}
        </button>
      )}
    </div>
  );
}
