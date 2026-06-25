"use client";

import type { AdRoastResult } from "@/types/insights";
import { ConfidencePill } from "@/components/ConfidencePill";

interface AdRoastSectionProps {
  roast: AdRoastResult;
}

export function AdRoastSection({ roast }: AdRoastSectionProps) {
  return (
    <div className="rounded-2xl animated-gradient-border bg-[#0a0a12]/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-semibold text-white">Ad Personality Roast</h3>
        <ConfidencePill level={roast.confidence} />
      </div>
      <p className="mt-3 text-lg font-medium text-white/90">{roast.personality}</p>
      <p className="mt-2 text-sm italic text-[#f9a8d4]/90">{roast.roastLine}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wider text-white/35">
            FBI agent&apos;s notes
          </p>
          <p className="mt-1 text-sm text-white/70">{roast.fbiNotes}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
          <p className="text-[10px] uppercase tracking-wider text-white/35">
            Ad identity crisis
          </p>
          <p className="mt-1 text-2xl font-bold text-white">
            {roast.identityCrisisScore}/100
          </p>
        </div>
      </div>
      {roast.brandsStalkingYou.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-white/40">Brands stalking you (from export)</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {roast.brandsStalkingYou.map((b) => (
              <span
                key={b}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] text-white/65"
              >
                {b}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
