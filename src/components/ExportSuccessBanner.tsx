"use client";

import { CheckCircle2, X, ArrowDown } from "lucide-react";

interface ExportSuccessBannerProps {
  visible: boolean;
  mode: "upload" | "saved";
  onDismiss: () => void;
  onJumpToDashboard: () => void;
}

export function ExportSuccessBanner({
  visible,
  mode,
  onDismiss,
  onJumpToDashboard,
}: ExportSuccessBannerProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2">
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-[#0a0a12]/95 px-4 py-3 shadow-2xl shadow-emerald-500/10 backdrop-blur-xl">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white">
            {mode === "upload"
              ? "Export loaded — dashboard ready."
              : "Saved analysis loaded — dashboard ready."}
          </p>
          <button
            type="button"
            onClick={onJumpToDashboard}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#515BD4] px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            Jump to dashboard
          </button>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-1 text-white/40 transition hover:bg-white/10 hover:text-white/70"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
