"use client";

import { useState } from "react";
import { Users, ChevronDown, ChevronUp } from "lucide-react";
import type { InsightsBundle, GroupChatInsight } from "@/types/insights";
import { formatTimestamp } from "@/lib/formatters";
import { usePresentationMode } from "@/contexts/PresentationContext";

const PAGE_SIZE = 8;

interface GroupChatsTabProps {
  insights: InsightsBundle | null;
}

export function GroupChatsTab({ insights }: GroupChatsTabProps) {
  const { presentationMode } = usePresentationMode();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [hideShareNamesLocal, setHideShareNamesLocal] = useState(false);
  const hideNames = presentationMode || hideShareNamesLocal;

  const groups = insights?.groupChats ?? [];

  if (!groups.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
        <Users className="mx-auto h-10 w-10 text-white/20" />
        <p className="mx-auto mt-4 max-w-md text-sm text-white/45">
          No group chats found in your export.
        </p>
      </div>
    );
  }

  const sorted = [...groups].sort((a, b) => b.totalMessages - a.totalMessages);
  const visible = sorted.slice(0, visibleCount);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const label = (name: string, i: number) =>
    hideNames ? `Person ${i + 1}` : name;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/50">
          {sorted.length} group chats · expand a row for participant roles
        </p>
        <label className="flex items-center gap-2 text-xs text-white/50">
          <input
            type="checkbox"
            checked={hideShareNamesLocal}
            onChange={(e) => setHideShareNamesLocal(e.target.checked)}
            disabled={presentationMode}
            className="accent-[#DD2A7B]"
          />
          Hide names for sharing
        </label>
      </div>

      {visible.map((group) => (
        <GroupRow
          key={group.threadId}
          group={group}
          isOpen={expanded.has(group.threadId)}
          onToggle={() => toggle(group.threadId)}
          hideNames={hideNames}
          label={label}
        />
      ))}

      {visibleCount < sorted.length && (
        <button
          type="button"
          onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-sm text-white/55 hover:bg-white/[0.06]"
        >
          Show more ({sorted.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
}

function GroupRow({
  group,
  isOpen,
  onToggle,
  hideNames,
  label,
}: {
  group: GroupChatInsight;
  isOpen: boolean;
  onToggle: () => void;
  hideNames: boolean;
  label: (name: string, i: number) => string;
}) {
  const title = hideNames
    ? `Group chat · ${group.participantCount} people`
    : group.title;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 p-4 text-left hover:bg-white/[0.02]"
      >
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-white truncate">{title}</h3>
          <p className="mt-1 text-xs text-white/45">
            Group chat · {group.participantCount} people ·{" "}
            {group.totalMessages.toLocaleString()} messages
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/40">
            {group.topSender && (
              <span>
                Top sender:{" "}
                {hideNames ? "—" : group.topSender}
              </span>
            )}
            {group.mostActiveMonth && (
              <span>Peak: {group.mostActiveMonth}</span>
            )}
            {group.lastActiveAt && (
              <span>Last active: {formatTimestamp(group.lastActiveAt)}</span>
            )}
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 shrink-0 text-white/40" />
        ) : (
          <ChevronDown className="h-5 w-5 shrink-0 text-white/40" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-white/8 px-4 pb-4 pt-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {group.roles.slice(0, 12).map((role, i) => (
              <div
                key={role.participant}
                className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
              >
                <p className="text-sm font-medium text-white">
                  {label(role.participant, i)}
                </p>
                <p className="text-xs text-[#DD2A7B]">{role.role}</p>
                <p className="text-xs text-white/40">
                  {role.messageCount.toLocaleString()} msgs · {role.messageShare}%
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/40">
            <span>Reels/posts: {group.reelsShared}</span>
            <span>Media: {group.mediaCount}</span>
            <span>Late night: {group.lateNightCount}</span>
          </div>
        </div>
      )}
    </div>
  );
}
