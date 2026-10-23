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
import { computeDisplayTitle, type NormalizedDmThread } from "@/lib/dmThreads";
import {
  formatSenderStats,
  resolveAiReadyMessages,
  threadHasAiSample,
} from "@/lib/dmMessageSampling";
import { friendlyAiError } from "@/lib/aiErrorMessages";
import { usePresentationMode } from "@/contexts/PresentationContext";

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
      <div className="sm:col-span-2 rounded-lg bg-ig-secondary p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-fg">
          One-liner
        </p>
        <p className="mt-1.5 text-sm font-semibold leading-snug text-fg">
          {summary.oneSentenceSummary}
        </p>
        <p className="mt-2 text-xs text-ig-muted">
          <span className="font-medium text-ig-muted">Chat vibe · </span>
          {summary.chatVibe}
        </p>
      </div>

      <div className="sm:col-span-2 rounded-lg border border-amber-500/30 bg-gradient-to-br from-amber-500/12 to-orange-600/5 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ig-warn">
          Roast · the main event
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-ig-warn">
          {summary.roast}
        </p>
      </div>

      <div className="rounded-lg border border-ig-border bg-ig-subtle p-3">
        <p className="text-[10px] uppercase tracking-wider text-ig-muted">
          Who carries
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-fg">
          {summary.whoCarries}
        </p>
      </div>

      <div className="rounded-lg border border-ig-border bg-ig-secondary p-3">
        <p className="text-[10px] uppercase tracking-wider text-fg">
          Wrapped award
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-fg">
          {summary.wrappedAward}
        </p>
      </div>

      {summary.signaturePatterns.length > 0 && (
        <div className="rounded-lg border border-ig-border bg-ig-subtle p-3 sm:col-span-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ig-muted">
            Signature patterns
          </p>
          <ul className="space-y-1">
            {summary.signaturePatterns.map((p) => (
              <li key={p} className="text-xs text-fg">
                → {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-ig-border bg-ig-subtle p-3 sm:col-span-2">
        <p className="text-[10px] uppercase tracking-wider text-ig-muted">
          Funniest dynamic
        </p>
        <p className="mt-1.5 text-xs text-fg">{summary.funniestDynamic}</p>
      </div>

      {summary.greenFlags.length > 0 && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ig-good">
            Green flags
          </p>
          <ul className="mt-1.5 space-y-1">
            {summary.greenFlags.map((f) => (
              <li key={f} className="text-xs text-ig-good">
                + {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.redFlags.length > 0 && (
        <div className="rounded-lg border border-red-500/25 bg-red-500/8 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ig-bad">
            Red flags
          </p>
          <ul className="mt-1.5 space-y-1">
            {summary.redFlags.map((f) => (
              <li key={f} className="text-xs text-ig-bad">
                − {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.confidenceNote && (
        <p className="text-center text-[11px] text-ig-muted sm:col-span-2">
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
    <div className="rounded-lg border border-red-500/25 bg-red-500/8 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ig-bad" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ig-bad">{message}</p>
          <p className="mt-2 text-[11px] text-ig-bad">
            If this only happens on the live site, check Vercel environment
            variables and redeploy.
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-ig-bad transition hover:bg-red-500/15"
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
  const { presentationMode } = usePresentationMode();
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

  const sendRealNames = useRealNames && !presentationMode;

  const buildPayload = useCallback(() => {
    const realNames = sendRealNames;
    const selectedMessages = resolveAiReadyMessages(thread, realNames);
    return {
      threadTitle: realNames ? thread.title : computeDisplayTitle(thread, false),
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
  }, [thread, tone, sendRealNames]);

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
      const data = await res.json().catch(() => ({}));

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
        usedRealNames: payload.useRealNames,
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
        <div className="flex items-center gap-2 rounded-lg border border-ig-border bg-ig-subtle px-4 py-5 text-sm text-ig-muted">
          <Loader2 className="h-4 w-4 animate-spin text-fg" />
          {loadingLine}
        </div>
      ) : saved ? (
        <div className="space-y-3">
          {presentationMode ? (
            <p className="rounded-lg border border-ig-border bg-ig-subtle px-4 py-5 text-center text-xs text-ig-muted">
              AI summary hidden while presenting.
            </p>
          ) : !showThreadNames && saved.usedRealNames !== false ? (
            <p className="rounded-lg border border-ig-border bg-ig-subtle px-4 py-5 text-center text-xs text-ig-muted">
              This summary may mention names — turn on “Show thread names” to view it.
            </p>
          ) : (
            <SummaryCards summary={saved.summary} />
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setTone(saved.tone === "funny" ? "wrapped" : saved.tone);
                setShowConfirm(true);
              }}
              disabled={loading || !hasSample || missingCloudSample}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ig-border bg-ig-secondary px-3 py-1.5 text-xs text-fg transition hover:bg-ig-hover disabled:opacity-40"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Regenerate
            </button>
            {!presentationMode && (
              <button
                type="button"
                onClick={copySummary}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ig-border bg-ig-secondary px-3 py-1.5 text-xs text-fg transition hover:bg-ig-hover"
              >
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copied!" : "Copy summary"}
              </button>
            )}
            <button
              type="button"
              onClick={() => onSummaryChange(thread.id, null)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-ig-bad transition hover:bg-red-500/15"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete summary
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {aiConfigured === false && (
            <p className="rounded-lg border border-ig-border bg-ig-subtle px-3 py-2 text-xs text-ig-muted">
              AI summaries are not configured on this deployment yet. Local DM
              stats still work without AI.
            </p>
          )}

          {!hasSample && (
            <p className="text-xs text-ig-muted">
              {missingCloudSample
                ? "AI summaries for saved analyses require an updated save. Re-upload your Instagram ZIP and save the analysis again to enable AI summaries from cloud saves."
                : "No message sample available for this thread. Re-upload your Instagram ZIP to enable AI summaries."}
            </p>
          )}

          {showConfirm ? (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ig-warn" />
                <p className="text-xs text-ig-warn">
                  This sends selected message text
                  {sendRealNames
                    ? " and participant names"
                    : " with anonymized sender labels"}{" "}
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
                  className="rounded-lg border border-ig-border px-4 py-1.5 text-xs text-fg hover:bg-ig-hover"
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
                    <label className="text-xs text-ig-muted">Tone</label>
                    <select
                      value={resolvedTone}
                      onChange={(e) =>
                        setTone(e.target.value as DmAiSummaryTone)
                      }
                      disabled={!hasSample || missingCloudSample || aiConfigured === false}
                      className="rounded-lg border border-ig-border bg-ig-secondary px-2 py-1 text-xs text-fg outline-none disabled:opacity-40"
                    >
                      {TONE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-ig-muted">
                    {TONE_OPTIONS.find((o) => o.value === resolvedTone)?.hint}
                  </p>
                </div>

                {showThreadNames && !presentationMode && (
                  <div className="rounded-lg border border-ig-border bg-ig-subtle px-3 py-2">
                    <label className="flex items-center gap-2 text-xs text-fg">
                      <input
                        type="checkbox"
                        checked={useRealNames}
                        onChange={(e) => setAllowRealNames(e.target.checked)}
                        className="accent-ig-blue"
                      />
                      Use real names in AI summary
                    </label>
                    <p className="mt-1 text-[11px] text-ig-muted">
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
                className="inline-flex items-center gap-2 rounded-lg animated-gradient-bg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
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
    <div className="mt-5 border-t border-ig-border pt-4">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-fg" />
        <h4 className="text-sm font-semibold text-fg">AI Summary</h4>
        <span className="rounded-full border border-ig-border bg-ig-secondary px-2 py-0.5 text-[10px] text-ig-muted">
          Optional
        </span>
      </div>
      {content}
    </div>
  );
}

export type { DmAiSummariesMap };
