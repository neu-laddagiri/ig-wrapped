"use client";

import { Sparkles } from "lucide-react";
import type {
  AdsPrivacyData,
  DmAnalytics,
  NetworkStats,
  WrappedInsights,
} from "@/types/instagram";
import { computeFunStats, resolveFunStatValue } from "@/lib/funStats";
import { normalizeDmThreads } from "@/lib/dmThreads";

interface FunStatsTabProps {
  network: NetworkStats | null;
  wrapped: WrappedInsights | null;
  messages: DmAnalytics | null;
  ads: AdsPrivacyData | null;
  showThreadNames: boolean;
}

export function FunStatsTab({
  network,
  wrapped,
  messages,
  ads,
  showThreadNames,
}: FunStatsTabProps) {
  const cards = computeFunStats({ network, wrapped, messages, ads });
  const threads = normalizeDmThreads(messages);
  const available = cards.filter((c) => c.available);

  if (available.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
        <Sparkles className="mx-auto h-10 w-10 text-white/20" />
        <h3 className="mt-4 text-lg font-semibold text-white">
          Not enough data yet
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
          Upload an export with network, activity, or message data to unlock
          fun stats.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#DD2A7B]/20 bg-gradient-to-br from-[#F58529]/10 via-[#DD2A7B]/10 to-[#515BD4]/10 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#DD2A7B]" />
          <h3 className="font-semibold text-white">Fun Stats</h3>
        </div>
        <p className="mt-2 text-sm text-white/50">
          Playful insights from your parsed export. DM thread names stay hidden
          unless you enable them in the DMs tab.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards
          .filter((c) => c.available)
          .map((card) => (
            <div
              key={card.id}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-white/15"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                {card.title}
              </p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-white">
                {resolveFunStatValue(card, showThreadNames, threads)}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-white/40">
                {card.description}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}
