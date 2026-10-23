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
    <div className="fixed inset-0 z-[82] flex items-end justify-center bg-black/60 p-4 sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="flex h-[calc(100dvh-2rem)] max-h-[560px] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-ig-border bg-ig-elevated shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-ig-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-fg" aria-hidden="true" />
            <h2 id={titleId} className="font-semibold text-fg">
              Ask IG Wrapped AI
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close IG Wrapped AI"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-fg hover:bg-ig-hover hover:text-fg"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <p
          id={descriptionId}
          className="border-b border-ig-border px-4 py-2 text-xs text-fg"
        >
          Uses parsed summaries only — not your raw ZIP. Search history excluded
          unless enabled below.
        </p>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-ig-muted">Suggested prompts:</p>
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="block min-h-11 w-full rounded-lg border border-ig-border bg-ig-subtle px-3 py-2 text-left text-xs text-fg hover:bg-ig-hover"
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
                className={`rounded-lg px-3 py-2 text-sm ${
 m.role === "user"
 ? "ml-8 bg-ig-secondary text-fg"
 : "mr-8 border border-ig-border bg-ig-subtle text-fg"
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
            <div role="status" className="flex items-center gap-2 text-sm text-fg">
              <Loader2
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              Thinking…
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-ig-bad">
              {error}
            </p>
          )}
        </div>

        <div className="border-t border-ig-border p-3">
          <label className="mb-2 flex min-h-11 items-center gap-2 text-xs text-fg">
            <input
              type="checkbox"
              checked={includeSearch}
              onChange={(e) => setIncludeSearch(e.target.checked)}
              className="accent-ig-blue"
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
              Ask IG Wrapped AI a question
            </label>
            <input
              ref={inputRef}
              id={inputId}
              maxLength={1000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your parsed data…"
              className="min-w-0 flex-1 rounded-lg border border-ig-border bg-ig-secondary px-3 py-2 text-sm text-fg outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="min-h-11 rounded-lg animated-gradient-bg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => setMessages([])}
              aria-label="Clear chat"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-ig-border text-fg hover:bg-ig-hover hover:text-fg"
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
