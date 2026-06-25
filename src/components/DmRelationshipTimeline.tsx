"use client";

import type { DmRelationshipInsight } from "@/types/insights";
import type { NormalizedDmThread } from "@/lib/dmThreads";
import { formatTimestamp } from "@/lib/formatters";

interface DmRelationshipTimelineProps {
  thread: NormalizedDmThread;
  relationship?: DmRelationshipInsight;
  showNames: boolean;
  showFirstMessagePreview: boolean;
  formatSender: (name: string) => string;
}

function formatGap(ms?: number): string {
  if (!ms || ms <= 0) return "—";
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  if (days < 1) return "< 1 day";
  if (days < 30) return `${days} days`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"}`;
}

export function DmRelationshipTimeline({
  thread,
  relationship,
  showNames,
  showFirstMessagePreview,
  formatSender,
}: DmRelationshipTimelineProps) {
  const events: { label: string; detail: string }[] = [];

  if (thread.firstMessageAt) {
    events.push({
      label: "First message",
      detail: `${formatTimestamp(thread.firstMessageAt)}${
        thread.firstMessageSender
          ? ` · ${formatSender(thread.firstMessageSender)}`
          : ""
      }`,
    });
  }
  if (showFirstMessagePreview && thread.firstMessageText) {
    events.push({
      label: "First preview",
      detail: thread.firstMessageText.slice(0, 120),
    });
  }
  if (thread.lastMessageAt) {
    events.push({
      label: "Last active",
      detail: `${formatTimestamp(thread.lastMessageAt)}${
        thread.lastMessageSender
          ? ` · ${formatSender(thread.lastMessageSender)}`
          : ""
      }`,
    });
  }
  if (thread.mostActiveMonth || relationship?.mostActiveMonth) {
    events.push({
      label: "Peak month",
      detail: thread.mostActiveMonth ?? relationship?.mostActiveMonth ?? "—",
    });
  }
  if (relationship?.longestGapMs) {
    events.push({
      label: "Longest silence",
      detail: formatGap(relationship.longestGapMs),
    });
  }
  if (relationship?.mostActiveDay) {
    events.push({
      label: "Most active day",
      detail: relationship.mostActiveDay,
    });
  }
  if (relationship?.mostActiveHour != null) {
    events.push({
      label: "Most active hour",
      detail: `${relationship.mostActiveHour}:00 UTC`,
    });
  }

  if (!events.length) return null;

  return (
    <section className="mb-5">
      <h5 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-white/35">
        Relationship timeline
      </h5>
      <div className="relative pl-4">
        <div className="absolute bottom-2 left-[7px] top-2 w-px bg-gradient-to-b from-[#DD2A7B]/50 via-[#8134AF]/40 to-[#515BD4]/30" />
        <ul className="space-y-3">
          {events.map((ev) => (
            <li key={ev.label} className="relative flex gap-3">
              <span className="absolute -left-4 mt-1.5 h-2.5 w-2.5 rounded-full border border-[#DD2A7B]/50 bg-[#0a0a12]" />
              <div className="min-w-0 flex-1 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {ev.label}
                </p>
                <p className="mt-0.5 text-sm text-white/80">{ev.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {!showNames && (
        <p className="mt-2 text-[10px] text-white/35">
          Names hidden in presentation mode.
        </p>
      )}
    </section>
  );
}
