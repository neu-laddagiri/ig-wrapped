"use client";

import { Eye, EyeOff } from "lucide-react";
import { usePresentationMode } from "@/contexts/PresentationContext";

export function PresentationToggle() {
  const { presentationMode, togglePresentationMode } = usePresentationMode();

  return (
    <button
      type="button"
      onClick={togglePresentationMode}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium backdrop-blur-sm transition ${
        presentationMode
          ? "border-[#515BD4]/40 bg-[#515BD4]/15 text-[#c4b5fd]"
          : "border-white/15 bg-white/5 text-white/60 hover:text-white/80"
      }`}
    >
      {presentationMode ? (
        <EyeOff className="h-3.5 w-3.5" />
      ) : (
        <Eye className="h-3.5 w-3.5" />
      )}
      Presentation
    </button>
  );
}
