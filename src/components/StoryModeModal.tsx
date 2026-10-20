"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import { resolveMostActiveEra } from "@/lib/mostActiveEra";
import { resolveDmAwardLabel } from "@/lib/dmDisplayLabels";
import { usePresentationMode } from "@/contexts/PresentationContext";

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

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function StoryModeModal({ open, ...props }: StoryModeModalProps) {
  // Mounting the dialog only while open gives every opening a fresh slide index.
  if (!open) return null;
  return <StoryModeDialog {...props} />;
}

function StoryModeDialog({
  onClose,
  data,
  insights,
  hideNames,
  onHideNamesChange,
}: Omit<StoryModeModalProps, "open">) {
  const { presentationMode } = usePresentationMode();
  const [index, setIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  const slides = useMemo((): StorySlide[] => {
    const { network, messages, ads, wrapped } = data;
    const personality = insights.personality;
    const award = insights.dmAwards[0];
    const scoreboard = insights.wrappedScoreboard;
    const era = resolveMostActiveEra(data);

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
          era?.mostActiveMonthLabel ?? "Not enough data",
          era ? `${formatNumber(era.mostActiveMonthCount)} tracked actions` : "",
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
          ? [resolveDmAwardLabel(award, !hideNames), award.description]
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
          hideNames
            ? "Names are hidden for sharing."
            : "Names are visible — uncheck “Show names” before sharing.",
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") onClose();
      else if (e.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (!dialog.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && (active === first || active === dialog)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="IG Wrapped Story Mode"
        tabIndex={-1}
        className="relative flex h-full max-h-[640px] w-full max-w-lg flex-col overflow-hidden rounded-3xl animated-gradient-border bg-[#0a0a12] outline-none"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <label
            className="flex items-center gap-2 text-xs text-white/50"
            title={
              presentationMode
                ? "Turn off Presentation Mode to show names"
                : undefined
            }
          >
            <input
              type="checkbox"
              checked={!hideNames}
              disabled={presentationMode}
              onChange={(e) => onHideNamesChange(!e.target.checked)}
              className="accent-[#DD2A7B]"
            />
            Show names
          </label>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Story Mode"
            className="rounded-lg p-2 text-white/40 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="flex flex-1 flex-col items-center justify-center px-8 py-10 text-center"
          aria-live="polite"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={slide.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.35 }}
              className="w-full"
            >
              <Icon className="mx-auto h-10 w-10 text-[#DD2A7B]" />
              {slide.subtitle && (
                <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                  {slide.subtitle}
                </p>
              )}
              <h2 className="mt-2 text-3xl font-bold text-white">{slide.title}</h2>
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
          <div className="mb-4 flex justify-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index
                    ? "w-6 animated-gradient-bg"
                    : "w-1.5 bg-white/20"
                }`}
                aria-label={`Go to slide ${i + 1} of ${total}`}
                aria-current={i === index ? "step" : undefined}
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => go(-1)}
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
            <span className="text-xs text-white/35">
              {index + 1} / {total}
            </span>
            <button
              type="button"
              disabled={index === total - 1}
              onClick={() => go(1)}
              className="inline-flex items-center gap-1 rounded-xl animated-gradient-bg px-4 py-2 text-sm font-medium text-white disabled:opacity-30"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
