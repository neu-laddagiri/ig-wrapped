"use client";

import { useState } from "react";
import type { InsightsBundle } from "@/types/insights";
import { Modal } from "@/components/ig/Modal";
import { ShareWrappedCard } from "@/components/ShareWrappedCard";

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  insights: InsightsBundle;
  /** Forced on while presenting. */
  presentationMode: boolean;
}

/** Instagram-style "Share" sheet for the downloadable Wrapped cards. */
export function ShareSheet({ open, onClose, insights, presentationMode }: ShareSheetProps) {
  const cards = insights.shareCards;
  const [cardId, setCardId] = useState<string | null>(null);
  // Names on cards are opt-in.
  const [showNames, setShowNames] = useState(false);
  const card =
    cards.find((c) => c.id === cardId) ??
    cards.find((c) => c.id === "overall") ??
    cards[0];
  const hideNames = presentationMode || !showNames;

  return (
    <Modal open={open && Boolean(card)} onClose={onClose} title="Share" size="sm" bodyClassName="p-4">
      {card && (
        <div className="space-y-4">
          {cards.length > 1 && (
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {cards.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCardId(c.id)}
                  aria-pressed={c.id === card.id}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold ${
                    c.id === card.id ? "bg-fg text-ig-bg" : "bg-ig-secondary text-fg hover:bg-ig-hover"
                  }`}
                >
                  {c.title}
                </button>
              ))}
            </div>
          )}
          <ShareWrappedCard
            card={card}
            hideNames={hideNames}
            personalityTitle={card.id === "overall" ? insights.personality?.title : undefined}
          />
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>
              Show names on the card
              <span className="block text-xs text-ig-muted">
                {presentationMode ? "Off while presenting" : "Off by default so it's safe to post"}
              </span>
            </span>
            <input
              type="checkbox"
              checked={!hideNames}
              disabled={presentationMode}
              onChange={(e) => setShowNames(e.target.checked)}
              className="h-5 w-5 accent-ig-blue"
            />
          </label>
        </div>
      )}
    </Modal>
  );
}
