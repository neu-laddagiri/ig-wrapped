"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Info, ChevronDown } from "lucide-react";
import type { AccountSourceBreakdown } from "@/types/insights";
import { formatTimestamp } from "@/lib/formatters";
import { usePresentationMode } from "@/contexts/PresentationContext";

interface AccountSourcesPopoverProps {
  breakdown?: AccountSourceBreakdown;
  compact?: boolean;
}

const PANEL_WIDTH = 256;
const PANEL_GAP = 4;
const EDGE = 8;
const ESTIMATED_PANEL_HEIGHT = 220;

/** Fixed-position panel in a portal so table/drawer overflow never clips it. */
function panelPosition(button: HTMLElement): CSSProperties {
  const rect = button.getBoundingClientRect();
  const left = Math.max(
    EDGE,
    Math.min(rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - EDGE)
  );
  const fitsBelow =
    rect.bottom + PANEL_GAP + ESTIMATED_PANEL_HEIGHT <= window.innerHeight;
  return fitsBelow
    ? { left, top: rect.bottom + PANEL_GAP }
    : { left, bottom: window.innerHeight - rect.top + PANEL_GAP };
}

export function AccountSourcesPopover({
  breakdown,
  compact,
}: AccountSourcesPopoverProps) {
  const { presentationMode } = usePresentationMode();
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const open = position !== null;

  useEffect(() => {
    if (!open) return;
    const close = () => setPosition(null);
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      close();
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  if (!breakdown) return null;

  const confidenceColor =
    breakdown.confidence === "high"
      ? "text-ig-good"
      : breakdown.confidence === "medium"
        ? "text-ig-warn"
        : "text-ig-muted";

  const toggle = () => {
    if (open || !buttonRef.current) {
      setPosition(null);
      return;
    }
    setPosition(panelPosition(buttonRef.current));
  };

  return (
    <div className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={`inline-flex items-center gap-1 rounded-lg border border-ig-border bg-ig-secondary text-ig-muted hover:bg-ig-hover hover:text-fg ${
 compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
 }`}
      >
        <Info className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
        Sources
        <ChevronDown
          className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="region"
            aria-label="Data sources for this account"
            style={{ ...position, width: PANEL_WIDTH }}
            className="fixed z-[88] rounded-lg border border-ig-border bg-ig-elevated p-3 text-xs shadow-xl"
          >
            <p className={`font-semibold ${confidenceColor}`}>
              Confidence: {breakdown.confidence}
            </p>
            <ul className="mt-2 space-y-1 text-ig-muted">
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
            {!presentationMode && breakdown.explanations.length > 0 && (
              <ul className="mt-2 space-y-0.5 border-t border-ig-border pt-2 text-ig-muted">
                {breakdown.explanations.map((e, i) => (
                  <li key={`${i}-${e}`}>· {e}</li>
                ))}
              </ul>
            )}
            {breakdown.isUnknownAccount && (
              <p className="mt-2 text-[10px] leading-relaxed text-ig-warn">
                Instagram export did not include a stable name for this account.
              </p>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
