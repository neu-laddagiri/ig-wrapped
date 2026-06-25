"use client";

import { useState } from "react";
import { Sparkles, ChevronDown } from "lucide-react";
import type { ConversationChemistry } from "@/lib/conversationChemistry";
import { ConfidencePill } from "@/components/ConfidencePill";

interface ConversationChemistryPanelProps {
  chemistry: ConversationChemistry;
}

export function ConversationChemistryPanel({
  chemistry,
}: ConversationChemistryPanelProps) {
  const [open, setOpen] = useState(true);

  return (
    <section className="mb-5 rounded-2xl border border-[#DD2A7B]/20 bg-gradient-to-br from-[#F58529]/5 via-[#DD2A7B]/5 to-[#515BD4]/5 p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#DD2A7B]" />
          <h5 className="text-sm font-semibold text-white">
            Conversation chemistry
          </h5>
          <ConfidencePill level={chemistry.confidence} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-white">
            {chemistry.overallScore}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-white/40 transition ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      <p className="mt-1 text-[10px] italic text-white/40">{chemistry.disclaimer}</p>
      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {chemistry.metrics.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-white/75">{m.label}</p>
                <span className="text-xs tabular-nums text-white/45">{m.score}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-white/45">{m.value}</p>
              <div className="animated-gradient-progress mt-2 h-1">
                <div
                  className="h-full animated-gradient-bar"
                  style={{ width: `${m.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
