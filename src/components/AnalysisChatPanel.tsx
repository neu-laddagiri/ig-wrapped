"use client";

import { useId, useRef, useState } from "react";
import { Bot, Loader2, Trash2, X } from "lucide-react";
import { buildOverviewMetrics } from "@/lib/overviewMetrics";
import type { ParsedExportData } from "@/types/instagram";
import type { LinkedInHelperEntry } from "@/types/instagram";
import { useAccessibleDialog } from "@/components/useAccessibleDialog";

const SUGGESTED = [
  "Who should I review for cleanup?",
  "Summarize my Instagram personality.",
  "What are my strongest social patterns?",
  "What should I check for privacy?",
  "Who are my closest mutuals based on data?",
];

interface AnalysisChatPanelProps {
  open: boolean;
  onClose: () => void;
  parsed: ParsedExportData;
  linkedinProgress: LinkedInHelperEntry[];
}

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

export function AnalysisChatPanel({
  open,
  onClose,
  parsed,
  linkedinProgress,
}: AnalysisChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeSearch, setIncludeSearch] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useAccessibleDialog<HTMLDivElement>({
    open,
    onClose,
    initialFocusRef: inputRef,
  });

  if (!open) return null;

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    setError(null);
    setLoading(true);
    const userMsg: ChatMessage = { role: "user", text: text.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");

    try {
      const metrics = buildOverviewMetrics(parsed, linkedinProgress);
      const res = await fetch("/api/analysis-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text.trim(),
          metrics,
          includeSearch,
          history: messages.slice(-6),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not get a response.");
        return;
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", text: data.answer ?? "No response." },
      ]);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="flex h-[calc(100dvh-2rem)] max-h-[560px] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c12] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-[#DD2A7B]" aria-hidden="true" />
            <h2 id={titleId} className="font-semibold text-white">
              AI Data Analyst
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close AI Data Analyst"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p
          id={descriptionId}
          className="border-b border-white/5 px-4 py-2 text-xs text-white/60"
        >
          Uses parsed summaries only — not your raw ZIP. Search history excluded
          unless enabled below.
        </p>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-white/45">Suggested prompts:</p>
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="block min-h-11 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs text-white/70 hover:bg-white/5"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <div
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-busy={loading}
            className="space-y-3"
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-8 bg-[#DD2A7B]/15 text-white"
                    : "mr-8 border border-white/10 bg-white/[0.04] text-white/80"
                }`}
              >
                <span className="sr-only">
                  {m.role === "user" ? "You: " : "AI Analyst: "}
                </span>
                {m.text}
              </div>
            ))}
          </div>
          {loading && (
            <div role="status" className="flex items-center gap-2 text-sm text-white/60">
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              Thinking…
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-300/90">
              {error}
            </p>
          )}
        </div>

        <div className="border-t border-white/10 p-3">
          <label className="mb-2 flex min-h-11 items-center gap-2 text-xs text-white/60">
            <input
              type="checkbox"
              checked={includeSearch}
              onChange={(e) => setIncludeSearch(e.target.checked)}
              className="accent-[#DD2A7B]"
            />
            Include search history summary (sensitive)
          </label>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
          >
            <label htmlFor={inputId} className="sr-only">
              Ask the AI Data Analyst a question
            </label>
            <input
              ref={inputRef}
              id={inputId}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your parsed data…"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="min-h-11 rounded-xl animated-gradient-bg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => setMessages([])}
              aria-label="Clear chat"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-white/60 hover:bg-white/5 hover:text-white"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
