"use client";

import { Eye, EyeOff } from "lucide-react";
import { usePresentationMode } from "@/contexts/PresentationContext";

export function PresentationModeBanner() {
  const { presentationMode, togglePresentationMode } = usePresentationMode();
  if (!presentationMode) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#515BD4]/30 bg-[#515BD4]/10 px-4 py-3">
      <div className="flex items-center gap-2">
        <EyeOff className="h-5 w-5 text-[#818cf8]" />
        <p className="text-sm text-white/80">
          <span className="font-semibold text-white">Presentation Mode on</span>
          {" — "}
          sensitive details hidden across all tabs.
        </p>
      </div>
      <button
        type="button"
        onClick={togglePresentationMode}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10"
      >
        <Eye className="h-3.5 w-3.5" />
        Turn off
      </button>
    </div>
  );
}
