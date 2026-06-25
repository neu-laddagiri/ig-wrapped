"use client";

import { useMemo, useState } from "react";
import { BookOpen, Copy, Check, Shield } from "lucide-react";
import type { YearbookCard, YearbookCategory } from "@/types/insights";
import { formatAccountDisplayName } from "@/lib/accountNameFilter";
import { ConfidencePill } from "@/components/ConfidencePill";
import { usePresentationMode } from "@/contexts/PresentationContext";

interface YearbookTabProps {
  cards: YearbookCard[];
  showNames?: boolean;
  onOpenAccount?: (username: string) => void;
}

const CATEGORY_STYLES: Record<
  YearbookCategory,
  { pill: string; glow: string }
> = {
  DMs: {
    pill: "border-[#DD2A7B]/35 bg-[#DD2A7B]/10 text-[#f9a8d4]",
    glow: "hover:shadow-[0_8px_32px_rgba(221,42,123,0.15)]",
  },
  Network: {
    pill: "border-[#515BD4]/35 bg-[#515BD4]/10 text-[#a5b4fc]",
    glow: "hover:shadow-[0_8px_32px_rgba(81,91,212,0.15)]",
  },
  Groups: {
    pill: "border-[#F58529]/35 bg-[#F58529]/10 text-[#fdba74]",
    glow: "hover:shadow-[0_8px_32px_rgba(245,133,41,0.15)]",
  },
  Search: {
    pill: "border-cyan-500/30 bg-cyan-500/10 text-cyan-200/90",
    glow: "hover:shadow-[0_8px_32px_rgba(34,211,238,0.12)]",
  },
  Ads: {
    pill: "border-purple-500/30 bg-purple-500/10 text-purple-200/90",
    glow: "hover:shadow-[0_8px_32px_rgba(168,85,247,0.12)]",
  },
  Privacy: {
    pill: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200/90",
    glow: "hover:shadow-[0_8px_32px_rgba(16,185,129,0.12)]",
  },
};

function displayWinnerName(
  card: YearbookCard,
  showNames: boolean
): string {
  if (!showNames) return "Hidden for sharing";
  return formatAccountDisplayName(card.winnerLabel);
}

function cardCopyText(card: YearbookCard, showNames: boolean): string {
  const name = displayWinnerName(card, showNames);
  return `${card.superlative}\n${name}\n${card.caption}`;
}

export function YearbookTab({
  cards,
  showNames: showNamesProp = true,
  onOpenAccount,
}: YearbookTabProps) {
  const { presentationMode } = usePresentationMode();
  const [hideShareNamesLocal, setHideShareNamesLocal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const showNames =
    showNamesProp && !presentationMode && !hideShareNamesLocal;

  const stats = useMemo(() => {
    const dmAwards = cards.filter((c) => c.category === "DMs").length;
    const networkAwards = cards.filter((c) => c.category === "Network").length;
    return {
      total: cards.length,
      dmAwards,
      networkAwards,
    };
  }, [cards]);

  const handleCopy = async (card: YearbookCard) => {
    const text = cardCopyText(card, showNames);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(card.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  if (!cards.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
        <BookOpen className="mx-auto h-10 w-10 text-white/20" />
        <p className="mt-4 text-sm text-white/45">
          Not enough data for yearbook superlatives in this export.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl animated-gradient-border bg-gradient-to-br from-[#0a0a12] via-[#12121a] to-[#0a0a12] p-6 sm:p-8">
        <div className="animated-gradient-bg absolute inset-x-0 top-0 h-1" />
        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">
                IG Wrapped
              </p>
              <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
                Your IG Yearbook
              </h2>
              <p className="mt-2 max-w-lg text-sm text-white/50">
                Superlatives from your Instagram universe — screenshot-ready
                award cards.
              </p>
            </div>
            {!presentationMode && (
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/55">
                <input
                  type="checkbox"
                  checked={hideShareNamesLocal}
                  onChange={(e) => setHideShareNamesLocal(e.target.checked)}
                  className="accent-[#DD2A7B]"
                />
                Hide names for public sharing
              </label>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <StatPill label="Awards" value={stats.total} />
            <StatPill label="DM awards" value={stats.dmAwards} />
            <StatPill label="Network awards" value={stats.networkAwards} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-medium text-white/45">
              <Shield className="h-3 w-3" />
              {showNames ? "Names visible" : "Privacy-safe mode"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const styles = CATEGORY_STYLES[card.category] ?? CATEGORY_STYLES.Network;
          const winnerName = displayWinnerName(card, showNames);

          return (
            <article
              key={card.id}
              className={`group relative flex flex-col rounded-2xl animated-gradient-border bg-[#0a0a12]/95 p-5 transition duration-300 hover:-translate-y-0.5 hover:border-white/20 ${styles.glow}`}
            >
              <div className="animated-gradient-bg mb-4 h-1 w-full rounded-full" />

              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                  Yearbook
                </p>
                {card.icon && (
                  <span className="text-xl" aria-hidden>
                    {card.icon}
                  </span>
                )}
              </div>

              <h3 className="mt-3 text-sm font-semibold leading-snug text-[#f9a8d4]">
                {card.superlative}
              </h3>

              {card.winnerUsername && showNames ? (
                <button
                  type="button"
                  onClick={() => onOpenAccount?.(card.winnerUsername!)}
                  className="mt-3 text-left text-2xl font-bold leading-tight text-white transition hover:text-[#DD2A7B]"
                >
                  {winnerName}
                </button>
              ) : (
                <p className="mt-3 text-2xl font-bold leading-tight text-white">
                  {winnerName}
                </p>
              )}

              <p className="mt-2 flex-1 text-sm leading-relaxed text-white/45">
                {card.caption}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles.pill}`}
                >
                  {card.category}
                </span>
                {card.confidence && (
                  <ConfidencePill level={card.confidence} />
                )}
              </div>

              <button
                type="button"
                onClick={() => handleCopy(card)}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] py-2 text-xs font-medium text-white/55 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white/75"
              >
                {copiedId === card.id ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy card text
                  </>
                )}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs">
      <span className="font-bold tabular-nums text-white">{value}</span>
      <span className="text-white/40">{label}</span>
    </span>
  );
}
