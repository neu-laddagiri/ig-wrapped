"use client";

import { Eye, ShieldCheck } from "lucide-react";
import { usePresentationMode } from "@/contexts/PresentationContext";

export function PresentationPrivacyGuard() {
  const { togglePresentationMode } = usePresentationMode();

  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-ig-border bg-ig-secondary px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-ig-secondary">
        <ShieldCheck className="h-6 w-6 text-fg" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-fg">
        This view is hidden while presenting
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-fg">
        It can reveal identities, messages, searches, security details, private
        notes, or raw export data. Aggregate and share-safe views remain
        available.
      </p>
      <button
        type="button"
        onClick={togglePresentationMode}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-ig-border bg-ig-secondary px-5 py-2 text-sm font-medium text-fg transition hover:bg-ig-hover"
      >
        <Eye className="h-4 w-4" />
        Turn off Presentation Mode
      </button>
    </div>
  );
}
