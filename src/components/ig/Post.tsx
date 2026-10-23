"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Send,
} from "lucide-react";
import { BrandAvatar } from "@/components/ig/Avatar";

export interface PostProps {
  /** Account shown in the header; insight posts come from the IG Wrapped account. */
  author?: string;
  authorAvatar?: ReactNode;
  /** Muted line under the author, like a post's location. */
  subtitle?: string;
  /** One media node, or several for a swipeable carousel. */
  slides: ReactNode[];
  mediaLabel: string;
  aspect?: "square" | "portrait";
  /** Bold line under the actions, where Instagram shows the like count. */
  highlight?: ReactNode;
  caption?: string;
  viewAll?: { label: string; onClick: () => void };
  /** Comment icon and the "Ask…" row open the AI chat. */
  onAsk?: () => void;
  /** Name-free text copied by the share button. */
  shareText?: string;
  /** Replaces copy-to-clipboard, e.g. to open the share-card sheet. */
  onShareClick?: () => void;
  onToast?: (message: string) => void;
  footer?: ReactNode;
}

export function Post({
  author = "ig.wrapped",
  authorAvatar,
  subtitle,
  slides,
  mediaLabel,
  aspect = "square",
  highlight,
  caption,
  viewAll,
  onAsk,
  shareText,
  onShareClick,
  onToast,
  footer,
}: PostProps) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [popKey, setPopKey] = useState(0);
  const [burstKey, setBurstKey] = useState(0);
  const [index, setIndex] = useState(0);
  const [captionOpen, setCaptionOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const count = slides.length;

  const toggleLike = () => {
    setLiked((v) => !v);
    setPopKey((k) => k + 1);
  };

  // Double-tap to like, like the app.
  const likeFromMedia = () => {
    setLiked(true);
    setPopKey((k) => k + 1);
    setBurstKey((k) => k + 1);
  };

  const scrollTo = (next: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(count - 1, next));
    track.scrollTo({ left: clamped * track.clientWidth, behavior: "smooth" });
  };

  const share = async () => {
    if (onShareClick) {
      onShareClick();
      return;
    }
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      onToast?.("Copied to clipboard");
    } catch {
      onToast?.("Couldn't copy — your browser blocked clipboard access");
    }
  };

  const ask = onAsk ?? viewAll?.onClick;

  return (
    <article className="border-b border-ig-border pb-5">
      <header className="flex items-center gap-3 px-1 pb-3">
        {authorAvatar ?? <BrandAvatar size={32} />}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-fg">{author}</p>
          {subtitle && (
            <p className="truncate text-xs text-fg">{subtitle}</p>
          )}
        </div>
      </header>

      <div className="relative overflow-hidden rounded-[4px] border border-ig-border bg-ig-bg">
        <div
          ref={trackRef}
          role="group"
          aria-roledescription={count > 1 ? "carousel" : undefined}
          aria-label={mediaLabel}
          onDoubleClick={likeFromMedia}
          onScroll={(e) => {
            const el = e.currentTarget;
            const next = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
            if (next !== index) setIndex(next);
          }}
          className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        >
          {slides.map((slide, i) => (
            <div
              key={i}
              aria-roledescription={count > 1 ? "slide" : undefined}
              aria-label={count > 1 ? `${i + 1} of ${count}` : undefined}
              className={`@container relative w-full shrink-0 snap-center ${
                aspect === "portrait" ? "aspect-[4/5]" : "aspect-square"
              }`}
            >
              {slide}
            </div>
          ))}
        </div>

        {burstKey > 0 && (
          <span
            key={burstKey}
            aria-hidden
            className="heart-burst pointer-events-none absolute inset-0 m-auto flex h-24 w-24 items-center justify-center"
          >
            <Heart className="h-24 w-24 fill-white text-white drop-shadow-lg" />
          </span>
        )}

        {count > 1 && (
          <>
            <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
              {index + 1}/{count}
            </span>
            {index > 0 && (
              <CarouselArrow side="left" onClick={() => scrollTo(index - 1)} />
            )}
            {index < count - 1 && (
              <CarouselArrow side="right" onClick={() => scrollTo(index + 1)} />
            )}
          </>
        )}
      </div>

      <div className="relative flex items-center px-1 pt-2">
        <div className="flex items-center gap-1">
          <ActionButton
            label={liked ? "Unlike" : "Like"}
            pressed={liked}
            onClick={toggleLike}
          >
            <Heart
              key={popKey}
              className={`h-6 w-6 ${popKey ? "heart-pop" : ""} ${
                liked ? "fill-ig-red text-ig-red" : ""
              }`}
            />
          </ActionButton>
          {ask && (
            <ActionButton label={onAsk ? "Ask AI about this" : "Open details"} onClick={ask}>
              <MessageCircle className="h-6 w-6" />
            </ActionButton>
          )}
          {(shareText || onShareClick) && (
            <ActionButton label={onShareClick ? "Share" : "Copy to share"} onClick={share}>
              <Send className="h-6 w-6" />
            </ActionButton>
          )}
        </div>

        {count > 1 && (
          <div className="absolute left-1/2 flex -translate-x-1/2 gap-1" aria-hidden>
            {slides.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === index ? "bg-ig-blue" : "bg-ig-border-strong"
                }`}
              />
            ))}
          </div>
        )}

        <div className="ml-auto">
          <ActionButton
            label={saved ? "Remove from saved" : "Save"}
            pressed={saved}
            onClick={() => {
              setSaved((v) => !v);
              onToast?.(saved ? "Removed from saved" : "Saved");
            }}
          >
            <Bookmark className={`h-6 w-6 ${saved ? "fill-current" : ""}`} />
          </ActionButton>
        </div>
      </div>

      <div className="space-y-1.5 px-1 pt-1">
        {highlight && <p className="text-sm font-semibold text-fg">{highlight}</p>}
        {caption && (
          <div className="text-sm text-fg">
            <p className={captionOpen ? "" : "line-clamp-2"}>
              <span className="mr-1 font-semibold">{author}</span>
              {caption}
            </p>
            {!captionOpen && caption.length > 110 && (
              <button
                type="button"
                onClick={() => setCaptionOpen(true)}
                className="text-ig-muted"
              >
                more
              </button>
            )}
          </div>
        )}
        {viewAll && (
          <button
            type="button"
            onClick={viewAll.onClick}
            className="block text-left text-sm text-ig-muted hover:opacity-80"
          >
            {viewAll.label}
          </button>
        )}
        {footer}
        {onAsk && (
          <button
            type="button"
            onClick={onAsk}
            className="block w-full pt-1 text-left text-sm text-ig-muted"
          >
            Ask IG Wrapped AI about this…
          </button>
        )}
      </div>
    </article>
  );
}

function ActionButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className="rounded-full p-2 text-fg transition-opacity hover:opacity-60"
    >
      {children}
    </button>
  );
}

function CarouselArrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={side === "left" ? "Previous slide" : "Next slide"}
      onClick={onClick}
      className={`absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-black shadow transition hover:bg-white ${
        side === "left" ? "left-2" : "right-2"
      }`}
    >
      <Icon className="h-4 w-4" strokeWidth={2.5} />
    </button>
  );
}
