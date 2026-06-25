"use client";

import { useState } from "react";
import { Bot, Loader2, Trash2, X } from "lucide-react";
import { buildOverviewMetrics } from "@/lib/overviewMetrics";
import type { ParsedExportData } from "@/types/instagram";
import type { LinkedInHelperEntry } from "@/types/instagram";

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
      <div className="flex h-[min(560px,90vh)] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-[#0c0c12] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-[#DD2A7B]" />
            <h3 className="font-semibold text-white">AI Data Analyst</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-white/40 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="border-b border-white/5 px-4 py-2 text-[10px] text-white/40">
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
                  className="block w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs text-white/70 hover:bg-white/5"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "ml-8 bg-[#DD2A7B]/15 text-white"
                  : "mr-8 border border-white/10 bg-white/[0.04] text-white/80"
              }`}
            >
              {m.text}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-white/40">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking…
            </div>
          )}
          {error && <p className="text-sm text-red-300/90">{error}</p>}
        </div>

        <div className="border-t border-white/10 p-3">
          <label className="mb-2 flex items-center gap-2 text-[10px] text-white/40">
            <input
              type="checkbox"
              checked={includeSearch}
              onChange={(e) => setIncludeSearch(e.target.checked)}
              className="accent-[#DD2A7B]"
            />
            Include search history summary (sensitive)
          </label>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void send(input)}
              placeholder="Ask about your parsed data…"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => void send(input)}
              className="rounded-xl animated-gradient-bg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => setMessages([])}
              className="rounded-xl border border-white/10 p-2 text-white/40"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
