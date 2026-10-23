"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Heart,
  Pause,
  Play,
  Send,
  X,
} from "lucide-react";
import type { ParsedExportData } from "@/types/instagram";
import type { InsightsBundle } from "@/types/insights";
import { formatNumber } from "@/lib/formatters";
import { resolveMostActiveEra } from "@/lib/mostActiveEra";
import { resolveDmAwardLabel } from "@/lib/dmDisplayLabels";
import { plural } from "@/lib/profileOwner";
import { usePresentationMode } from "@/contexts/PresentationContext";
import { useAccessibleDialog } from "@/components/useAccessibleDialog";
import { BrandAvatar } from "@/components/ig/Avatar";
import { Wordmark } from "@/components/ig/Logo";
import { CANVAS_TONES, type CanvasTone } from "@/components/feed/Canvas";

/** Story tray entries; each opens the viewer at its first slide. */
export type StoryChapter =
  | "welcome"
  | "network"
  | "dms"
  | "era"
  | "ads"
  | "security"
  | "personality";

export interface StorySlide {
  id: string;
  chapter?: StoryChapter;
  tone: CanvasTone;
  label: string;
  body: ReactNode;
  /** Seconds on screen before auto-advancing. */
  seconds?: number;
}

interface StoryModeModalProps {
  open: boolean;
  onClose: () => void;
  data: ParsedExportData;
  insights: InsightsBundle;
  hideNames: boolean;
  onHideNamesChange: (v: boolean) => void;
  startAt?: StoryChapter;
  /** Opens the share-card sheet. */
  onShare?: () => void;
}

/** The Wrapped story: your export as a run of Instagram-style story slides. */
export function StoryModeModal({ open, ...props }: StoryModeModalProps) {
  // Mounting only while open gives every opening a fresh position.
  if (!open) return null;
  return <WrappedStory {...props} />;
}

function WrappedStory({
  onClose,
  data,
  insights,
  hideNames,
  onHideNamesChange,
  startAt = "welcome",
  onShare,
}: Omit<StoryModeModalProps, "open">) {
  const slides = useMemo(
    () => buildSlides(data, insights, hideNames),
    [data, insights, hideNames]
  );
  return (
    <StoryViewerModal
      open
      onClose={onClose}
      slides={slides}
      startIndex={Math.max(0, slides.findIndex((s) => s.chapter === startAt))}
      names={{ hidden: hideNames, onChange: onHideNamesChange }}
      onShare={onShare}
    />
  );
}

interface StoryViewerProps {
  open: boolean;
  onClose: () => void;
  slides: StorySlide[];
  startIndex?: number;
  /** Eye toggle for slides that can show names. */
  names?: { hidden: boolean; onChange: (hidden: boolean) => void };
  onShare?: () => void;
}

/** Full-screen story viewer: progress bars, tap or arrow keys to move, hold to pause. */
export function StoryViewerModal({ open, ...props }: StoryViewerProps) {
  if (!open || typeof document === "undefined" || props.slides.length === 0) return null;
  return createPortal(<StoryViewer {...props} />, document.body);
}

function StoryViewer({
  onClose,
  slides,
  startIndex = 0,
  names,
  onShare,
}: Omit<StoryViewerProps, "open">) {
  const { presentationMode } = usePresentationMode();
  const [index, setIndex] = useState(startIndex);
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(false);
  const pressStart = useRef<number | null>(null);
  const dialogRef = useAccessibleDialog<HTMLDivElement>({ open: true, onClose });

  const total = slides.length;
  const slide = slides[Math.min(index, total - 1)];

  const go = (dir: -1 | 1) => {
    if (dir === 1 && index >= total - 1) {
      onClose();
      return;
    }
    setIndex((i) => Math.max(0, Math.min(total - 1, i + dir)));
    setLiked(false);
  };

  // Arrow keys and space, on top of Escape/Tab from useAccessibleDialog.
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goRef.current(1);
      else if (e.key === "ArrowLeft") goRef.current(-1);
      else if (e.key === " " && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!slide) return null;
  const tone = CANVAS_TONES[slide.tone];
  const share = onShare
    ? () => {
        onClose();
        onShare();
      }
    : undefined;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="IG Wrapped story"
      tabIndex={-1}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#1a1a1a] outline-none"
    >
      <span className="absolute left-5 top-4 hidden text-white md:block">
        <Wordmark className="text-[28px]" />
      </span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close story"
        className="absolute right-3 top-3 z-30 rounded-full p-2 text-white hover:bg-white/10"
      >
        <X className="h-7 w-7" />
      </button>

      <div className="flex items-center gap-5">
        <SideArrow side="left" hidden={index === 0} onClick={() => go(-1)} />

        <div
          className="@container relative aspect-[9/16] h-[100dvh] max-w-[100vw] overflow-hidden sm:h-[min(92vh,860px)] sm:rounded-lg"
          style={{ background: tone.background, color: tone.color }}
        >
          {/* Progress */}
          <div className="absolute inset-x-0 top-0 z-20 flex gap-[3px] px-2 pt-2">
            {slides.map((s, i) => (
              <span key={s.id} className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/35">
                {i < index && <span className="block h-full w-full bg-white" />}
                {i === index && (
                  <span
                    key={`${s.id}-${index}`}
                    className="story-progress-fill block h-full w-full bg-white"
                    data-paused={paused}
                    style={{ ["--story-duration" as string]: `${s.seconds ?? 5}s` }}
                    onAnimationEnd={() => go(1)}
                  />
                )}
              </span>
            ))}
          </div>

          {/* Header */}
          <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-gradient-to-b from-black/35 to-transparent px-3 pb-6 pt-5 text-white">
            <BrandAvatar size={32} />
            <p className="text-sm font-semibold">ig.wrapped</p>
            <p className="truncate text-sm text-white/75">{slide.label}</p>
            <div className="ml-auto flex items-center">
              {names && (
                <button
                  type="button"
                  onClick={() => names.onChange(!names.hidden)}
                  disabled={presentationMode}
                  aria-label={names.hidden ? "Show names" : "Hide names"}
                  title={
                    presentationMode
                      ? "Turn off presentation mode to show names"
                      : names.hidden
                        ? "Show names"
                        : "Hide names"
                  }
                  className="rounded-full p-2 hover:bg-white/10 disabled:opacity-40"
                >
                  {names.hidden ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? "Play" : "Pause"}
                className="rounded-full p-2 hover:bg-white/10"
              >
                {paused ? (
                  <Play className="h-5 w-5 fill-current" />
                ) : (
                  <Pause className="h-5 w-5 fill-current" />
                )}
              </button>
            </div>
          </div>

          {/* Tap zones: the left third goes back, the rest forward; hold to pause. */}
          <div
            className="absolute inset-0 z-10"
            onPointerDown={() => {
              pressStart.current = Date.now();
              setPaused(true);
            }}
            onPointerUp={(e) => {
              const held = pressStart.current ? Date.now() - pressStart.current : 0;
              pressStart.current = null;
              setPaused(false);
              if (held > 250) return;
              const rect = e.currentTarget.getBoundingClientRect();
              go(e.clientX - rect.left < rect.width / 3 ? -1 : 1);
            }}
            onPointerLeave={() => {
              if (pressStart.current) {
                pressStart.current = null;
                setPaused(false);
              }
            }}
            aria-hidden
          />

          <div
            className="pointer-events-none absolute inset-0 flex flex-col justify-center px-[9cqw] pb-[24cqw] pt-[26cqw]"
            aria-live="polite"
          >
            <div key={slide.id} className="ig-fade-up">
              {slide.body}
            </div>
          </div>

          {/* Footer */}
          <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-3 px-4 pb-4 pt-8 text-white">
            {index === total - 1 && share ? (
              <button
                type="button"
                onClick={share}
                className="flex-1 rounded-full border border-white/80 px-4 py-2.5 text-sm font-semibold hover:bg-white/10"
              >
                Share your Wrapped card
              </button>
            ) : (
              <p className="flex-1 truncate rounded-full border border-white/50 px-4 py-2.5 text-sm text-white/85">
                {index + 1} of {total} · tap to continue
              </p>
            )}
            <button
              type="button"
              onClick={() => setLiked((v) => !v)}
              aria-label={liked ? "Unlike" : "Like"}
              aria-pressed={liked}
              className="rounded-full p-1"
            >
              <Heart className={`h-7 w-7 ${liked ? "heart-pop fill-[#ff3040] text-[#ff3040]" : ""}`} />
            </button>
            {share && (
              <button type="button" onClick={share} aria-label="Share" className="rounded-full p-1">
                <Send className="h-7 w-7" />
              </button>
            )}
          </div>
        </div>

        <SideArrow side="right" onClick={() => go(1)} />
      </div>
    </div>
  );
}

function SideArrow({
  side,
  hidden,
  onClick,
}: {
  side: "left" | "right";
  hidden?: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous" : "Next"}
      className={`hidden h-8 w-8 items-center justify-center rounded-full bg-white/85 text-black hover:bg-white md:flex ${
        hidden ? "invisible" : ""
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={2.5} />
    </button>
  );
}

function Big({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <p
      className="font-bold leading-[0.9] tracking-[-0.04em] tabular-nums"
      style={{ fontSize: `${size}cqw` }}
    >
      {children}
    </p>
  );
}

function Line({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return (
    <p
      className={`mt-[4cqw] leading-snug ${
        strong ? "text-[6.5cqw] font-semibold" : "text-[5cqw] opacity-90"
      }`}
    >
      {children}
    </p>
  );
}

function buildSlides(
  data: ParsedExportData,
  insights: InsightsBundle,
  hideNames: boolean
): StorySlide[] {
  const { network, messages, ads, wrapped, security } = data;
  const era = resolveMostActiveEra(data);
  const award = insights.dmAwards[0];
  const personality = insights.personality;
  const scoreboard = insights.wrappedScoreboard;
  const roast = insights.adRoast;
  const slides: StorySlide[] = [
    {
      id: "welcome",
      chapter: "welcome",
      tone: "gradient",
      label: "Wrapped",
      body: (
        <>
          <p className="text-[9cqw] font-bold leading-none">Your Instagram,</p>
          <p className="pb-[4cqw] font-logo text-[30cqw] leading-[0.9]">Wrapped</p>
          <Line>
            Everything here came from your own data export, parsed right in your browser.
          </Line>
        </>
      ),
      seconds: 4,
    },
  ];

  if (network) {
    const notBack = network.dontFollowMeBack.length;
    slides.push(
      {
        id: "network",
        chapter: "network",
        tone: "purple",
        label: "Your circle",
        body: (
          <>
            <Big>{formatNumber(network.totalFollowers)}</Big>
            <Line strong>{network.totalFollowers === 1 ? "follower" : "followers"}</Line>
            <Line>
              You follow {formatNumber(network.totalFollowing)} and share{" "}
              {plural(network.mutuals.length, "mutual")}.
            </Line>
          </>
        ),
      },
      {
        id: "ratio",
        chapter: "network",
        tone: "pink",
        label: "Follow-backs",
        body: (
          <>
            <Big>{Math.round(network.followBackRatio * 100)}%</Big>
            <Line strong>of the people you follow follow you back</Line>
            <Line>
              {plural(notBack, "account")} {notBack === 1 ? "doesn't" : "don't"}. No judgement.
            </Line>
          </>
        ),
      }
    );
  }

  if (era) {
    slides.push({
      id: "era",
      chapter: "era",
      tone: "orange",
      label: "Peak era",
      body: (
        <>
          <Line strong>Your most active month</Line>
          <Big size={15}>{era.mostActiveMonthLabel}</Big>
          <Line>
            {formatNumber(era.mostActiveMonthCount)} things you did on Instagram that month.
          </Line>
        </>
      ),
    });
  }

  if (messages) {
    slides.push({
      id: "dms",
      chapter: "dms",
      tone: "magenta",
      label: "Messages",
      body: (
        <>
          <Big>{formatNumber(messages.totalMessages)}</Big>
          <Line strong>{messages.totalMessages === 1 ? "message" : "messages"} in your DMs</Line>
          <Line>
            {plural(messages.oneOnOneCount, "chat")} and{" "}
            {plural(messages.groupChatCount, "group chat")}.
          </Line>
        </>
      ),
    });
    if (award) {
      slides.push({
        id: "award",
        chapter: "dms",
        tone: "ink",
        label: "DM award",
        body: (
          <>
            <p className="text-[5cqw] font-semibold uppercase tracking-[0.14em] text-white/70">
              {award.title}
            </p>
            <p className="text-ig-gradient mt-[3cqw] text-[12cqw] font-bold leading-[0.95]">
              {resolveDmAwardLabel(award, !hideNames)}
            </p>
            <Line>{award.description}</Line>
          </>
        ),
      });
    }
  }

  if (wrapped && wrapped.storiesViewed > 0) {
    slides.push({
      id: "content",
      chapter: "dms",
      tone: "purple",
      label: "Your feed",
      body: (
        <>
          <Big size={18}>{formatNumber(wrapped.storiesViewed)}</Big>
          <Line strong>stories watched</Line>
          <Line>
            {insights.contentDiet?.caption ?? ""} You liked{" "}
            {plural(wrapped.likedPosts, "post")} along the way.
          </Line>
        </>
      ),
    });
  }

  if (ads) {
    slides.push({
      id: "ads",
      chapter: "ads",
      tone: "yellow",
      label: "Ads",
      body: (
        <>
          <Line strong>Instagram thinks…</Line>
          <p className="mt-[3cqw] text-[10cqw] font-bold leading-[1.02] tracking-tight">
            “{roast?.roastLine ?? "it knows you pretty well."}”
          </p>
          <Line>
            {plural(ads.advertisersCount, "advertiser")} had your info ·{" "}
            {plural(ads.adsViewed, "ad")} seen.
          </Line>
        </>
      ),
      seconds: 6,
    });
  }

  if (security) {
    const flagged = security.suspiciousLoginAnalysis?.flaggedEvents.length ?? 0;
    slides.push({
      id: "security",
      chapter: "security",
      tone: "ink",
      label: "Security",
      body: (
        <>
          <Line strong>Security check-up</Line>
          <Big>{insights.securityAudit?.healthScore ?? "—"}</Big>
          <Line>
            {plural(security.loginCount, "login")} in your export
            {flagged ? ` · ${plural(flagged, "event")} worth a look` : " · nothing unusual"}.
          </Line>
        </>
      ),
    });
  }

  if (personality) {
    slides.push({
      id: "personality",
      chapter: "personality",
      tone: "ink",
      label: "Personality",
      body: (
        <>
          <Line strong>You&apos;re</Line>
          <p className="text-ig-gradient mt-[2cqw] text-[14cqw] font-bold leading-[0.95] tracking-tight">
            {personality.title}
          </p>
          <Line>{personality.description}</Line>
        </>
      ),
      seconds: 6,
    });
  }

  slides.push({
    id: "finale",
    chapter: "personality",
    tone: "gradient",
    label: "That's a wrap",
    body: (
      <>
        <p className="font-logo text-[24cqw] leading-[0.9]">That&apos;s a wrap</p>
        {scoreboard && <Line strong>IG health: {scoreboard.overallHealth}/100</Line>}
        <Line>{scoreboard?.verdict ?? "Thanks for unwrapping your Instagram."}</Line>
        <Line>
          {hideNames
            ? "Names are hidden, so this is safe to screenshot."
            : "Names are showing — tap the eye before you screenshot."}
        </Line>
      </>
    ),
    seconds: 7,
  });

  return slides;
}
