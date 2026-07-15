"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Sparkles,
  Loader2,
  Copy,
  Trash2,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import type {
  DmAiSummariesMap,
  DmAiSummarySaved,
  DmAiSummaryTone,
  DmAiSummaryResult,
} from "@/types/dmAiSummary";
import { formatTimestamp } from "@/lib/formatters";
import type { NormalizedDmThread } from "@/lib/dmThreads";
import {
  formatSenderStats,
  resolveAiReadyMessages,
  threadHasAiSample,
} from "@/lib/dmMessageSampling";
import { friendlyAiError } from "@/lib/aiErrorMessages";

const TONE_OPTIONS: { value: DmAiSummaryTone; label: string; hint: string }[] =
  [
    {
      value: "wrapped",
      label: "Wrapped",
      hint: "Dramatic, balanced, screenshot-worthy",
    },
    {
      value: "drama",
      label: "Drama",
      hint: "Maximum tea — tension, flirting, chaos",
    },
    { value: "savage", label: "Savage", hint: "Sharper roast, calls out mixed signals" },
    { value: "real", label: "Real", hint: "Honest social read, fewer jokes" },
    {
      value: "wholesome",
      label: "Wholesome",
      hint: "Warm — cute energy allowed",
    },
  ];

const LOADING_LINES = [
  "Reading the receipts…",
  "Judging the chat respectfully…",
];

function formatStatDate(ts?: number): string | undefined {
  if (!ts) return undefined;
  const f = formatTimestamp(ts);
  return f === "—" ? undefined : f;
}

interface DmAiSummarySectionProps {
  thread: NormalizedDmThread;
  showThreadNames: boolean;
  saved?: DmAiSummarySaved;
  onSummaryChange: (threadId: string, summary: DmAiSummarySaved | null) => void;
  /** When true, skip outer section chrome (used inside DmsTab expanded panel) */
  embedded?: boolean;
  /** True when analysis was loaded from cloud without a fresh ZIP upload */
  isLoadedFromCloud?: boolean;
}

function SummaryCards({ summary }: { summary: DmAiSummaryResult }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      <div className="sm:col-span-2 animated-gradient-border rounded-xl bg-gradient-to-br from-[#F58529]/10 via-[#DD2A7B]/10 to-[#515BD4]/10 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#DD2A7B]/85">
          One-liner
        </p>
        <p className="mt-1.5 text-sm font-semibold leading-snug text-white">
          {summary.oneSentenceSummary}
        </p>
        <p className="mt-2 text-xs text-white/55">
          <span className="font-medium text-white/40">Chat vibe · </span>
          {summary.chatVibe}
        </p>
      </div>

      <div className="sm:col-span-2 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/12 to-orange-600/5 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/90">
          Roast · the main event
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-amber-50/95">
          {summary.roast}
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <p className="text-[10px] uppercase tracking-wider text-white/40">
          Who carries
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-white/80">
          {summary.whoCarries}
        </p>
      </div>

      <div className="rounded-xl border border-[#515BD4]/25 bg-[#515BD4]/8 p-3">
        <p className="text-[10px] uppercase tracking-wider text-[#515BD4]/80">
          Wrapped award
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-white/85">
          {summary.wrappedAward}
        </p>
      </div>

      {summary.signaturePatterns.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:col-span-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Signature patterns
          </p>
          <ul className="space-y-1">
            {summary.signaturePatterns.map((p) => (
              <li key={p} className="text-xs text-white/70">
                → {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:col-span-2">
        <p className="text-[10px] uppercase tracking-wider text-white/40">
          Funniest dynamic
        </p>
        <p className="mt-1.5 text-xs text-white/75">{summary.funniestDynamic}</p>
      </div>

      {summary.greenFlags.length > 0 && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/85">
            Green flags
          </p>
          <ul className="mt-1.5 space-y-1">
            {summary.greenFlags.map((f) => (
              <li key={f} className="text-xs text-emerald-100/90">
                + {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.redFlags.length > 0 && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/8 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-300/85">
            Red flags
          </p>
          <ul className="mt-1.5 space-y-1">
            {summary.redFlags.map((f) => (
              <li key={f} className="text-xs text-red-100/90">
                − {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.confidenceNote && (
        <p className="text-center text-[11px] text-white/30 sm:col-span-2">
          {summary.confidenceNote}
        </p>
      )}
    </div>
  );
}

function ErrorCard({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-500/25 bg-red-500/8 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-red-100/90">{message}</p>
          <p className="mt-2 text-[11px] text-red-200/50">
            If this only happens on the live site, check Vercel environment
            variables and redeploy.
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-500/15"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function DmAiSummarySection({
  thread,
  showThreadNames,
  saved,
  onSummaryChange,
  embedded = false,
  isLoadedFromCloud = false,
}: DmAiSummarySectionProps) {
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [tone, setTone] = useState<DmAiSummaryTone>(saved?.tone ?? "wrapped");
  const [allowRealNames, setAllowRealNames] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingLine] = useState(
    () => LOADING_LINES[Math.floor(Math.random() * LOADING_LINES.length)]
  );

  const hasSample = threadHasAiSample(thread);
  const missingCloudSample = isLoadedFromCloud && !hasSample;
  const useRealNames = showThreadNames && allowRealNames;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dm-summary")
      .then((r) => r.json())
      .then((data: { configured?: boolean }) => {
        if (!cancelled) setAiConfigured(Boolean(data.configured));
      })
      .catch(() => {
        if (!cancelled) setAiConfigured(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const buildPayload = useCallback(() => {
    const realNames = useRealNames;
    const selectedMessages = resolveAiReadyMessages(thread, realNames);
    return {
      threadTitle: thread.title,
      participantCount: thread.participantCount,
      isGroup: thread.isGroup,
      useRealNames: realNames,
      participants: realNames ? thread.participants : undefined,
      tone,
      stats: {
        totalMessages: thread.totalMessages,
        linkCount: thread.linkCount,
        reelOrPostCount: thread.reelOrPostCount,
        mediaCount: thread.mediaCount,
        photoCount: thread.photoCount,
        videoCount: thread.videoCount,
        audioCount: thread.audioCount,
        reactionCount: thread.reactionCount,
        callCount: thread.callCount,
        averageMessageLength: thread.averageMessageLength,
        firstMessageAt: formatStatDate(thread.firstMessageAt),
        lastMessageAt: formatStatDate(thread.lastMessageAt),
        mostActiveMonth: thread.mostActiveMonth,
        messagesBySender: formatSenderStats(
          thread.messagesBySender,
          realNames
        ),
      },
      selectedMessages,
    };
  }, [thread, tone, useRealNames]);

  const generate = async () => {
    setError(null);
    setLoading(true);
    setShowConfirm(false);

    try {
      const payload = buildPayload();
      const res = await fetch("/api/dm-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(friendlyAiError(
          typeof data.error === "string" ? data.error : undefined,
          "summary"
        ));
        return;
      }

      if (!data.summary) {
        setError(friendlyAiError("json parse failed", "summary"));
        return;
      }

      onSummaryChange(thread.id, {
        threadId: thread.id,
        tone: tone === "funny" ? "wrapped" : tone,
        generatedAt: new Date().toISOString(),
        summary: data.summary as DmAiSummaryResult,
      });
    } catch {
      setError(friendlyAiError("network fetch failed", "summary"));
    } finally {
      setLoading(false);
    }
  };

  const copySummary = async () => {
    if (!saved?.summary) return;
    const s = saved.summary;
    const text = [
      s.oneSentenceSummary,
      s.roast,
      `Vibe: ${s.chatVibe}`,
      `Who carries: ${s.whoCarries}`,
      `Award: ${s.wrappedAward}`,
      s.signaturePatterns.length
        ? `Patterns:\n${s.signaturePatterns.map((p) => `• ${p}`).join("\n")}`
        : "",
      s.confidenceNote,
    ]
      .filter(Boolean)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  };

  const resolvedTone = tone === "funny" ? "wrapped" : tone;

  const content = (
    <>
      {loading ? (
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-white/50">
          <Loader2 className="h-4 w-4 animate-spin text-[#DD2A7B]" />
          {loadingLine}
        </div>
      ) : saved ? (
        <div className="space-y-3">
          <SummaryCards summary={saved.summary} />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setTone(saved.tone === "funny" ? "wrapped" : saved.tone);
                setShowConfirm(true);
              }}
              disabled={loading || !hasSample || missingCloudSample}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10 disabled:opacity-40"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </button>
            <button
              type="button"
              onClick={copySummary}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/10"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied!" : "Copy summary"}
            </button>
            <button
              type="button"
              onClick={() => onSummaryChange(thread.id, null)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-500/15"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete summary
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {aiConfigured === false && (
            <p className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/45">
              AI summaries are not configured on this deployment yet. Local DM
              stats still work without AI.
            </p>
          )}

          {!hasSample && (
            <p className="text-xs text-white/45">
              {missingCloudSample
                ? "AI summaries for saved analyses require an updated save. Re-upload your Instagram ZIP and save the analysis again to enable AI summaries from cloud saves."
                : "No message sample available for this thread. Re-upload your Instagram ZIP to enable AI summaries."}
            </p>
          )}

          {showConfirm ? (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-xs text-amber-100/90">
                  This sends selected message text
                  {showThreadNames && useRealNames
                    ? " and participant names"
                    : ""}{" "}
                  from this thread to the AI provider. Do not generate summaries
                  for chats you are not comfortable processing.
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={generate}
                  className="rounded-lg animated-gradient-bg px-4 py-1.5 text-xs font-semibold text-white"
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="rounded-lg border border-white/15 px-4 py-1.5 text-xs text-white/60 hover:bg-white/5"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-white/45">Tone</label>
                    <select
                      value={resolvedTone}
                      onChange={(e) =>
                        setTone(e.target.value as DmAiSummaryTone)
                      }
                      disabled={!hasSample || missingCloudSample || aiConfigured === false}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none disabled:opacity-40"
                    >
                      {TONE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-white/30">
                    {TONE_OPTIONS.find((o) => o.value === resolvedTone)?.hint}
                  </p>
                </div>

                {showThreadNames && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <label className="flex items-center gap-2 text-xs text-white/70">
                      <input
                        type="checkbox"
                        checked={useRealNames}
                        onChange={(e) => setAllowRealNames(e.target.checked)}
                        className="accent-[#DD2A7B]"
                      />
                      Use real names in AI summary
                    </label>
                    <p className="mt-1 text-[11px] text-white/35">
                      Using real names sends participant names with the selected
                      message sample.
                    </p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={!hasSample || missingCloudSample || loading || aiConfigured === false}
                className="inline-flex items-center gap-2 rounded-xl animated-gradient-bg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" />
                Generate AI Summary
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <ErrorCard
          message={error}
          onRetry={
            hasSample && !missingCloudSample && aiConfigured !== false
              ? generate
              : undefined
          }
        />
      )}
    </>
  );

  if (embedded) {
    return <div>{content}</div>;
  }

  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[#DD2A7B]" />
        <h4 className="text-sm font-semibold text-white">AI Summary</h4>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/40">
          Optional
        </span>
      </div>
      {content}
    </div>
  );
}

export type { DmAiSummariesMap };
