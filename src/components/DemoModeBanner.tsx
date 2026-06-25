"use client";

import { FlaskConical, X } from "lucide-react";

interface DemoModeBannerProps {
  onClear: () => void;
}

export function DemoModeBanner({ onClear }: DemoModeBannerProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-5 w-5 text-amber-300" />
        <p className="text-sm text-amber-100/90">
          <span className="font-semibold">Demo Mode</span>
          {" — "}
          synthetic data for exploration. No real accounts or private info.
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-100 hover:bg-amber-500/25"
      >
        <X className="h-3.5 w-3.5" />
        Clear demo data
      </button>
    </div>
  );
}
