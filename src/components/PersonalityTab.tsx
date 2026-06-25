"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { InsightsBundle } from "@/types/insights";
import { ShareWrappedCard } from "@/components/ShareWrappedCard";
import { usePresentationMode } from "@/contexts/PresentationContext";

interface PersonalityTabProps {
  insights: InsightsBundle | null;
}

export function PersonalityTab({ insights }: PersonalityTabProps) {
  const { presentationMode } = usePresentationMode();
  const [hideShareNamesLocal, setHideShareNamesLocal] = useState(false);
  const hideNames = presentationMode || hideShareNamesLocal;

  const personality = insights?.personality;
  const cards =
    insights?.shareCards.filter((c) => c.id !== "overall") ?? [];

  if (!personality) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
        <Sparkles className="mx-auto h-10 w-10 text-white/20" />
        <p className="mx-auto mt-4 max-w-md text-sm text-white/45">
          Not enough data to calculate your Instagram personality. Upload an
          export with network and activity data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl animated-gradient-border bg-gradient-to-br from-[#F58529]/15 via-[#DD2A7B]/15 to-[#515BD4]/15 p-6 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-[#DD2A7B]" />
        <h2 className="mt-3 text-2xl font-bold text-white">{personality.title}</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-white/55">
          {personality.description}
        </p>
        <ul className="mx-auto mt-4 max-w-md space-y-1 text-left text-sm text-white/60">
          {personality.reasons.map((r) => (
            <li key={r}>→ {r}</li>
          ))}
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {personality.stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center"
          >
            <p className="text-xs text-white/40">{s.label}</p>
            <p className="mt-1 text-xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-white">Shareable cards</h3>
          <label className="flex items-center gap-2 text-xs text-white/60">
            <input
              type="checkbox"
              checked={hideShareNamesLocal}
              onChange={(e) => setHideShareNamesLocal(e.target.checked)}
              disabled={presentationMode}
              className="accent-[#DD2A7B]"
            />
            Hide names for public sharing
          </label>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {cards.map((card) => (
            <ShareWrappedCard
              key={card.id}
              card={card}
              hideNames={hideNames}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
