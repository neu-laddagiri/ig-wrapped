"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  Users,
  MessageCircle,
  Shield,
  Brain,
} from "lucide-react";
import type { ParsedExportData } from "@/types/instagram";
import type { InsightsBundle } from "@/types/insights";
import { formatNumber } from "@/lib/formatters";
import { useAccessibleDialog } from "@/components/useAccessibleDialog";

interface StorySlide {
  id: string;
  title: string;
  subtitle?: string;
  lines: string[];
  icon: typeof Sparkles;
}

interface StoryModeModalProps {
  open: boolean;
  onClose: () => void;
  data: ParsedExportData;
  insights: InsightsBundle;
  hideNames: boolean;
  onHideNamesChange: (v: boolean) => void;
}

export function StoryModeModal({
  open,
  onClose,
  data,
  insights,
  hideNames,
  onHideNamesChange,
}: StoryModeModalProps) {
  const [index, setIndex] = useState(0);
  const titleId = useId();
  const counterId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const handleClose = useCallback(() => {
    setIndex(0);
    onClose();
  }, [onClose]);
  const dialogRef = useAccessibleDialog<HTMLDivElement>({
    open,
    onClose: handleClose,
    initialFocusRef: closeButtonRef,
  });

  const slides = useMemo((): StorySlide[] => {
    const { network, messages, ads, wrapped } = data;
    const personality = insights.personality;
    const award = insights.dmAwards[0];
    const scoreboard = insights.wrappedScoreboard;

    return [
      {
        id: "welcome",
        title: "Your IG Wrapped",
        subtitle: "Story Mode",
        lines: [
          "A quick tour of your Instagram export highlights.",
          "Based on available export data.",
        ],
        icon: Sparkles,
      },
      {
        id: "network",
        title: "Your network",
        lines: [
          `${formatNumber(network?.totalFollowers ?? 0)} followers`,
          `${formatNumber(network?.totalFollowing ?? 0)} following`,
          `${formatNumber(network?.mutuals.length ?? 0)} mutuals`,
        ],
        icon: Users,
      },
      {
        id: "ratio",
        title: "Follow-back ratio",
        lines: [
          `${Math.round((network?.followBackRatio ?? 0) * 100)}% follow-back rate`,
          `${formatNumber(network?.dontFollowMeBack.length ?? 0)} don't follow you back`,
        ],
        icon: Users,
      },
      {
        id: "era",
        title: "Most active era",
        lines: [
          data.mostActiveEra?.mostActiveMonthLabel ?? "Not enough data",
          data.mostActiveEra
            ? `${formatNumber(data.mostActiveEra.mostActiveMonthCount)} tracked actions`
            : "",
        ].filter(Boolean),
        icon: Sparkles,
      },
      {
        id: "dms",
        title: "DM activity",
        lines: [
          `${formatNumber(messages?.totalMessages ?? 0)} total messages`,
          `${formatNumber(messages?.totalThreads ?? 0)} threads`,
          `${formatNumber(messages?.groupChatCount ?? 0)} group chats`,
        ],
        icon: MessageCircle,
      },
      {
        id: "award",
        title: award?.title ?? "DM highlight",
        lines: award
          ? [award.description]
          : ["Upload message data to unlock DM awards."],
        icon: MessageCircle,
      },
      {
        id: "content",
        title: "Content diet",
        lines: insights.contentDiet
          ? [
              insights.contentDiet.caption,
              `${formatNumber(wrapped?.storiesViewed ?? 0)} story views`,
              `${formatNumber(wrapped?.likedPosts ?? 0)} liked posts`,
            ]
          : ["Activity style from your export."],
        icon: Sparkles,
      },
      {
        id: "ads",
        title: "Ads & privacy",
        lines: [
          `${formatNumber(ads?.adsViewed ?? 0)} ads viewed`,
          `Privacy creep score: ${insights.adsInsights?.privacyCreepScore ?? "—"}/100`,
        ],
        icon: Shield,
      },
      {
        id: "security",
        title: "Security score",
        lines: [
          `Health score: ${insights.securityAudit?.healthScore ?? "—"}/100`,
          `${formatNumber(data.security?.loginCount ?? 0)} logins in export`,
        ],
        icon: Shield,
      },
      {
        id: "personality",
        title: personality?.title ?? "Your personality",
        lines: personality
          ? [personality.description, ...personality.reasons.slice(0, 2)]
          : ["Not enough data for personality."],
        icon: Brain,
      },
      {
        id: "finale",
        title: "Final verdict",
        lines: [
          scoreboard
            ? `IG Health: ${scoreboard.overallHealth}/100`
            : "Wrapped complete",
          scoreboard?.verdict ?? "Thanks for exploring IG Wrapped.",
          hideNames ? "Names hidden for sharing." : "Toggle public-safe mode before sharing.",
        ],
        icon: Sparkles,
      },
    ];
  }, [data, insights, hideNames]);

  const total = slides.length;
  const slide = slides[index];
  const Icon = slide?.icon ?? Sparkles;

  const go = useCallback(
    (dir: -1 | 1) => {
      setIndex((i) => Math.max(0, Math.min(total - 1, i + dir)));
    },
    [total]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        e.target.matches("input, select, textarea")
      ) {
        return;
      }
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={counterId}
        tabIndex={-1}
        className="relative flex h-[calc(100dvh-2rem)] max-h-[640px] w-full max-w-lg flex-col overflow-hidden rounded-3xl animated-gradient-border bg-[#0a0a12]"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <label className="flex min-h-11 items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={!hideNames}
              onChange={(e) => onHideNamesChange(!e.target.checked)}
              className="accent-[#DD2A7B]"
            />
            Show names
          </label>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            aria-label="Close Story Mode"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8 text-center sm:px-8 sm:py-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${total}`}
              aria-live="polite"
              aria-atomic="true"
              initial={
                prefersReducedMotion ? false : { opacity: 0, x: 24 }
              }
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
              className="w-full"
            >
              <Icon
                className="mx-auto h-10 w-10 text-[#DD2A7B]"
                aria-hidden="true"
              />
              {slide.subtitle && (
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                  {slide.subtitle}
                </p>
              )}
              <h2 id={titleId} className="mt-2 text-3xl font-bold text-white">
                {slide.title}
              </h2>
              <ul className="mt-8 space-y-3">
                {slide.lines.map((line) => (
                  <li key={line} className="text-lg text-white/75">
                    {line}
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="border-t border-white/10 px-4 py-4">
          <div className="-mx-2 mb-2 overflow-x-auto px-2 pb-1">
            <div className="mx-auto flex w-max gap-1">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-lg"
                  aria-label={`Go to slide ${i + 1}: ${s.title}`}
                  aria-current={i === index ? "step" : undefined}
                >
                  <span
                    aria-hidden="true"
                    className={`h-1.5 rounded-full transition-all ${
                      i === index
                        ? "w-6 animated-gradient-bg"
                        : "w-1.5 bg-white/30"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => go(-1)}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </button>
            <span id={counterId} className="text-xs text-white/60">
              {index + 1} / {total}
            </span>
            <button
              type="button"
              disabled={index === total - 1}
              onClick={() => go(1)}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl animated-gradient-bg px-4 py-2 text-sm font-medium text-white disabled:opacity-30"
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
