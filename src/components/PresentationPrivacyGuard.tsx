"use client";

import { Eye, ShieldCheck } from "lucide-react";
import { usePresentationMode } from "@/contexts/PresentationContext";

export function PresentationPrivacyGuard() {
  const { togglePresentationMode } = usePresentationMode();

  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-[#515BD4]/25 bg-[#515BD4]/10 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#515BD4]/20">
        <ShieldCheck className="h-6 w-6 text-[#a5b4fc]" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-white">
        This view is hidden while presenting
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60">
        It can reveal identities, messages, searches, security details, private
        notes, or raw export data. Aggregate and share-safe views remain
        available.
      </p>
      <button
        type="button"
        onClick={togglePresentationMode}
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10"
      >
        <Eye className="h-4 w-4" />
        Turn off Presentation Mode
      </button>
    </div>
  );
}
