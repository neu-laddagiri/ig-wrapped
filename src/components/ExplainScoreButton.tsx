"use client";

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { ConfidencePill } from "@/components/ConfidencePill";
import type { ConfidenceLevel } from "@/types/insights";

interface ExplainLine {
  label: string;
  value: string | number;
}

interface ExplainScoreButtonProps {
  title: string;
  summary: string;
  lines: ExplainLine[];
  confidence?: ConfidenceLevel;
}

export function ExplainScoreButton({
  title,
  summary,
  lines,
  confidence = "medium",
}: ExplainScoreButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/50 hover:text-white/70"
      >
        <HelpCircle className="h-3 w-3" />
        Explain
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#0c0c12] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">{title}</h3>
                <ConfidencePill level={confidence} className="mt-2" />
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-white/55">{summary}</p>
            <ul className="mt-4 space-y-2">
              {lines.map((line) => (
                <li
                  key={line.label}
                  className="flex justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-xs"
                >
                  <span className="text-white/45">{line.label}</span>
                  <span className="font-medium text-white/85">{line.value}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[10px] text-white/35">
              Based on available export data. No raw private messages shown.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
