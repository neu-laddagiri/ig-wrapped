"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ConversationChemistry } from "@/lib/conversationChemistry";

interface ConversationChemistryPanelProps {
  chemistry: ConversationChemistry;
}

export function ConversationChemistryPanel({ chemistry }: ConversationChemistryPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-xl border border-ig-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ig-gradient text-sm font-bold text-white">
          {chemistry.overallScore}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-base font-semibold">Chat chemistry</span>
          <span className="block text-xs text-ig-muted">{chemistry.disclaimer}</span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-ig-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="divide-y divide-ig-border border-t border-ig-border px-4">
          {chemistry.metrics.map((m) => (
            <li key={m.id} className="py-2.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold">{m.label}</span>
                <span className="tabular-nums text-ig-muted">{m.score}</span>
              </div>
              <p className="mt-0.5 text-xs text-ig-muted">{m.value}</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-ig-secondary">
                <div className="h-full rounded-full bg-ig-gradient" style={{ width: `${m.score}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
