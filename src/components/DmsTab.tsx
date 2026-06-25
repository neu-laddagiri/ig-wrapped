"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MessageCircle,
  Inbox,
  MailWarning,
  Shield,
  ChevronDown,
  ChevronUp,
  Users,
  Search,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { DmAnalytics } from "@/types/instagram";
import { SummaryCard } from "@/components/SummaryCard";
import { formatNumber, formatTimestamp } from "@/lib/formatters";
import {
  normalizeDmThreadList,
  normalizeMessagesByMonth,
  dmCount,
  sortDmThreads,
  filterDmThreads,
  paginateDmThreads,
  withDisplayTitles,
  hasModernDmParser,
  isDirectDmThread,
  type NormalizedDmThread,
  type DmSortKey,
  type DmPageSize,
} from "@/lib/dmThreads";
import { DmThreadPagination } from "@/components/DmThreadPagination";
import { DmAiSummarySection } from "@/components/DmAiSummarySection";
import type { DmAiSummariesMap, DmAiSummarySaved } from "@/types/dmAiSummary";
import type { DmHeatmapResult, ReplyPatternResult, DmRelationshipInsight } from "@/types/insights";
import { DmHeatmapSection } from "@/components/DmHeatmapSection";
import { DmRelationshipTimeline } from "@/components/DmRelationshipTimeline";
import { ConversationChemistryPanel } from "@/components/ConversationChemistryPanel";
import { computeConversationChemistry } from "@/lib/conversationChemistry";

interface DmsTabProps {
  messages: DmAnalytics | null;
  showThreadNames?: boolean;
  onShowThreadNamesChange?: (value: boolean) => void;
  showFirstMessagePreview?: boolean;
  onShowFirstMessagePreviewChange?: (value: boolean) => void;
  dmAiSummaries?: DmAiSummariesMap;
  onDmAiSummariesChange?: (summaries: DmAiSummariesMap) => void;
  isLoadedFromCloud?: boolean;
  dmHeatmap?: DmHeatmapResult | null;
  replyPatterns?: ReplyPatternResult | null;
  dmRelationshipInsights?: DmRelationshipInsight[];
  onOpenAccount?: (target: import("@/lib/canonicalAccounts").AccountReceiptTarget) => void;
  dmAccountKeyByThreadId?: Map<string, string>;
}

import { formatAccountDisplayName, isInstagramPlaceholderName } from "@/lib/accountNameFilter";
import {
  buildSenderLabelMap,
  displaySenderLabel,
} from "@/lib/dmMessageSampling";

function formatDate(ts?: number): string {
  if (!ts) return "Not available";
  const formatted = formatTimestamp(ts);
  return formatted === "—" ? "Not available" : formatted;
}

function senderLabel(
  rawName: string,
  labelMap: Map<string, string>,
  showNames: boolean
): string {
  if (!showNames) return displaySenderLabel(rawName, labelMap);
  return formatAccountDisplayName(rawName);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h5 className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-white/35">
      {children}
    </h5>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-white/35">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-white/90">{value}</p>
    </div>
  );
}

function ThreadExpandedPanel({
  thread,
  showThreadNames,
  showFirstMessagePreview,
  showParticipants,
  onToggleParticipants,
  aiSummary,
  onAiSummaryChange,
  isLoadedFromCloud,
  relationship,
}: {
  thread: NormalizedDmThread;
  showThreadNames: boolean;
  showFirstMessagePreview: boolean;
  showParticipants: boolean;
  onToggleParticipants: () => void;
  aiSummary?: DmAiSummarySaved;
  onAiSummaryChange: (threadId: string, summary: DmAiSummarySaved | null) => void;
  isLoadedFromCloud?: boolean;
  relationship?: DmRelationshipInsight;
}) {
  const senderLabelMap = buildSenderLabelMap(
    thread.messagesBySender,
    showThreadNames
  );
  const senders = Object.entries(thread.messagesBySender).sort(
    (a, b) => b[1] - a[1]
  );
  const topCount = senders[0]?.[1] ?? 0;
  const chemistry = !thread.isGroup
    ? computeConversationChemistry(thread, relationship)
    : null;

  const legacyPanel = (
    <DmAiSummarySection
      thread={thread}
      showThreadNames={showThreadNames}
      saved={aiSummary}
      onSummaryChange={onAiSummaryChange}
      isLoadedFromCloud={isLoadedFromCloud}
    />
  );

  if (!thread.hasDetailedInsights) {
    return (
      <div className="border-t border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent px-4 py-5 sm:px-5">
        <p className="text-sm text-white/50">
          Detailed stats are not available for this thread. Re-upload your
          Instagram ZIP to refresh DM insights.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MiniStat
            label="Messages"
            value={formatNumber(thread.totalMessages)}
          />
          <MiniStat label="Folder" value={thread.folder.replace("_", " ")} />
        </div>
        {legacyPanel}
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent px-4 py-5 sm:px-5">
      {showThreadNames &&
        !thread.isGroup &&
        isInstagramPlaceholderName(thread.title) && (
          <p className="mb-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-white/40">
            Instagram&apos;s export did not include a usable name for this
            account.
          </p>
        )}
      <p className="mb-4 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs italic text-white/50">
        {thread.funSummary}
      </p>

      <section className="mb-5">
        <SectionTitle>Thread overview</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MiniStat
            label="Total messages"
            value={formatNumber(thread.totalMessages)}
          />
          <MiniStat
            label="First message"
            value={formatDate(thread.firstMessageAt)}
          />
          <MiniStat
            label="Last active"
            value={formatDate(thread.lastMessageAt)}
          />
          <MiniStat
            label="Most active month"
            value={thread.mostActiveMonth ?? "Not available"}
          />
          <MiniStat
            label="Avg length"
            value={
              thread.averageMessageLength != null
                ? `${thread.averageMessageLength} chars`
                : "Not available"
            }
          />
          <MiniStat label="Folder" value={thread.folder.replace("_", " ")} />
        </div>
      </section>

      <section className="mb-5">
        <SectionTitle>Activity timeline</SectionTitle>
        <DmRelationshipTimeline
          thread={thread}
          relationship={relationship}
          showNames={showThreadNames}
          showFirstMessagePreview={showFirstMessagePreview}
          formatSender={(name) =>
            senderLabel(name, senderLabelMap, showThreadNames)
          }
        />
      </section>

      {chemistry && (
        <ConversationChemistryPanel chemistry={chemistry} />
      )}

      <section className="mb-5">
        <SectionTitle>Shared content</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat label="Links" value={formatNumber(thread.linkCount)} />
          <MiniStat
            label="Reels / posts"
            value={formatNumber(thread.reelOrPostCount)}
          />
          <MiniStat label="Photos" value={formatNumber(thread.photoCount)} />
          <MiniStat label="Videos" value={formatNumber(thread.videoCount)} />
          <MiniStat label="Audio" value={formatNumber(thread.audioCount)} />
          <MiniStat
            label="Reactions"
            value={formatNumber(thread.reactionCount)}
          />
          <MiniStat label="Calls" value={formatNumber(thread.callCount)} />
        </div>
      </section>

      {senders.length > 0 && (
        <section className="mb-5">
          <SectionTitle>Message balance</SectionTitle>
          <div className="space-y-2">
            {senders.map(([name, count]) => {
              const pct =
                thread.totalMessages > 0
                  ? Math.round((count / thread.totalMessages) * 100)
                  : 0;
              const label = senderLabel(name, senderLabelMap, showThreadNames);
              return (
                <div key={`${thread.id}-bal-${name}`}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="truncate text-white/70">{label}</span>
                    <span className="shrink-0 text-white/45">
                      {formatNumber(count)} ({pct}%)
                    </span>
                  </div>
                  <div className="animated-gradient-progress h-1.5">
                    <div
                      className="h-full animated-gradient-bar"
                      style={{
                        width: `${Math.max(pct, count === topCount && pct < 4 ? 4 : 0)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mb-5">
        <SectionTitle>First message</SectionTitle>
        {showFirstMessagePreview ? (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
            <p className="text-[10px] uppercase tracking-wider text-amber-300/80">
              Preview · may contain private content
            </p>
            {(thread.firstMessageAt || thread.firstMessageSender) && (
              <p className="mt-1 text-xs text-amber-200/60">
                {thread.firstMessageAt &&
                  formatDate(thread.firstMessageAt)}
                {thread.firstMessageSender && (
                  <span>
                    {thread.firstMessageAt ? " · " : ""}
                    {senderLabel(
                      thread.firstMessageSender,
                      senderLabelMap,
                      showThreadNames
                    )}
                  </span>
                )}
              </p>
            )}
            <p className="mt-2 text-sm text-amber-100/90">
              {thread.firstMessageText?.trim()
                ? thread.firstMessageText.length > 200
                  ? `${thread.firstMessageText.slice(0, 200)}…`
                  : thread.firstMessageText
                : "No text preview available."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/70">
            {thread.firstMessageAt || thread.firstMessageSender ? (
              <>
                {thread.firstMessageAt && (
                  <span>{formatDate(thread.firstMessageAt)}</span>
                )}
                {thread.firstMessageSender && (
                  <span>
                    {thread.firstMessageAt ? " · " : ""}
                    Sender:{" "}
                    {senderLabel(
                      thread.firstMessageSender,
                      senderLabelMap,
                      showThreadNames
                    )}
                  </span>
                )}
              </>
            ) : (
              "Not available"
            )}
          </div>
        )}
      </section>

      {thread.isGroup && (
        <section className="mb-5">
          <button
            type="button"
            onClick={onToggleParticipants}
            className="text-xs font-medium text-[#DD2A7B] hover:underline"
          >
            {showParticipants ? "Hide participants" : "Show participants"}
          </button>
          {showParticipants && thread.participants.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {thread.participants.map((p, i) => (
                <span
                  key={`${thread.id}-p-${i}-${p}`}
                  className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70"
                >
                  {showThreadNames ? p : `Person ${i + 1}`}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <SectionTitle>AI summary</SectionTitle>
        <DmAiSummarySection
          thread={thread}
          showThreadNames={showThreadNames}
          saved={aiSummary}
          onSummaryChange={onAiSummaryChange}
          embedded
          isLoadedFromCloud={isLoadedFromCloud}
        />
      </section>
    </div>
  );
}

export function DmsTab({
  messages,
  showThreadNames: controlledShow,
  onShowThreadNamesChange,
  showFirstMessagePreview: controlledPreview,
  onShowFirstMessagePreviewChange,
  dmAiSummaries = {},
  onDmAiSummariesChange,
  isLoadedFromCloud = false,
  dmHeatmap,
  replyPatterns,
  dmRelationshipInsights = [],
  onOpenAccount,
  dmAccountKeyByThreadId,
}: DmsTabProps) {
  const [internalShow, setInternalShow] = useState(true);
  const [internalPreview, setInternalPreview] = useState(false);
  const [expandedThreadId, setExpandedThreadId] = useState<string | null>(null);
  const [participantsOpen, setParticipantsOpen] = useState<Set<string>>(
    new Set()
  );
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<DmPageSize>(10);
  const [sortBy, setSortBy] = useState<DmSortKey>("messages");

  const showThreadNames = controlledShow ?? internalShow;
  const setShowThreadNames = onShowThreadNamesChange ?? setInternalShow;
  const showFirstMessagePreview = controlledPreview ?? internalPreview;
  const setShowFirstMessagePreview =
    onShowFirstMessagePreviewChange ?? setInternalPreview;

  const baseThreads = useMemo(
    () => normalizeDmThreadList(messages),
    [messages]
  );

  const needsReupload =
    baseThreads.length > 0 &&
    !hasModernDmParser(messages) &&
    baseThreads.filter((t) => t.hasDetailedInsights).length <
      Math.max(1, baseThreads.length * 0.5);

  const displayThreads = useMemo(
    () => withDisplayTitles(baseThreads, showThreadNames),
    [baseThreads, showThreadNames]
  );

  const filtered = useMemo(
    () => filterDmThreads(displayThreads, search, showThreadNames),
    [displayThreads, search, showThreadNames]
  );

  const sorted = useMemo(
    () => sortDmThreads(filtered, sortBy),
    [filtered, sortBy]
  );

  const paged = useMemo(
    () => paginateDmThreads(sorted, page, pageSize),
    [sorted, page, pageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [search, sortBy, pageSize, showThreadNames]);

  useEffect(() => {
    if (
      expandedThreadId &&
      !baseThreads.some((t) => t.id === expandedThreadId)
    ) {
      setExpandedThreadId(null);
    }
  }, [baseThreads, expandedThreadId]);

  const hasMessageData =
    messages &&
    (baseThreads.length > 0 ||
      dmCount(messages, "totalMessages") > 0 ||
      dmCount(messages, "totalThreads") > 0);

  if (!hasMessageData) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
        <MessageCircle className="mx-auto h-10 w-10 text-white/20" />
        <h3 className="mt-4 text-lg font-semibold text-white">
          No message data found
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
          DM files from{" "}
          <code className="text-white/60">your_instagram_activity/messages/</code>{" "}
          were not detected.
        </p>
      </div>
    );
  }

  const chartData = normalizeMessagesByMonth(messages).map((m) => ({
    month: m.month,
    messages: m.count,
  }));

  const totalThreads = dmCount(messages, "totalThreads") || baseThreads.length;
  const oneOnOneCount =
    dmCount(messages, "oneOnOneCount") ||
    baseThreads.filter((t) => !t.isGroup).length;
  const groupChatCount =
    dmCount(messages, "groupChatCount") ||
    baseThreads.filter((t) => t.isGroup).length;

  const toggleExpand = (threadId: string) => {
    setExpandedThreadId((prev) => (prev === threadId ? null : threadId));
  };

  const toggleParticipants = (threadId: string) => {
    setParticipantsOpen((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  };

  const handleAiSummaryChange = (
    threadId: string,
    summary: DmAiSummarySaved | null
  ) => {
    if (!onDmAiSummariesChange) return;
    const next = { ...dmAiSummaries };
    if (summary) next[threadId] = summary;
    else delete next[threadId];
    onDmAiSummariesChange(next);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-emerald-200">
              DM analytics are private
            </p>
            <p className="mt-1 text-xs text-emerald-200/70">
              Thread names and message previews may include private information.
              Reveal only if you are comfortable viewing it.
            </p>
            <p className="mt-2 text-xs text-white/40">
              AI summaries are optional. Generating one sends selected text from
              that thread to the configured AI provider. Local stats do not
              require AI.
            </p>
          </div>
        </div>
      </div>

      {needsReupload && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <p className="text-sm text-amber-100/90">
              Detailed DM insights require re-uploading your Instagram ZIP with
              the latest parser. Summary counts are shown, but per-thread stats
              may be incomplete until you refresh.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          label="Total threads"
          value={formatNumber(totalThreads)}
          icon={MessageCircle}
          accent="pink"
        />
        <SummaryCard
          label="1:1 chats"
          value={formatNumber(oneOnOneCount)}
          icon={MessageCircle}
          accent="blue"
        />
        <SummaryCard
          label="Group chats"
          value={formatNumber(groupChatCount)}
          icon={Users}
          accent="purple"
        />
        <SummaryCard
          label="Inbox"
          value={formatNumber(dmCount(messages, "inboxThreads"))}
          icon={Inbox}
          accent="orange"
        />
        <SummaryCard
          label="Total messages"
          value={formatNumber(dmCount(messages, "totalMessages"))}
          icon={MailWarning}
          accent="green"
        />
      </div>

      {chartData.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">
            Messages by month
          </h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.06)"
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#12121a",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: "#fff",
                  }}
                />
                <Bar
                  dataKey="messages"
                  fill="url(#dmGradient)"
                  radius={[4, 4, 0, 0]}
                />
                <defs>
                  <linearGradient id="dmGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#DD2A7B" />
                    <stop offset="100%" stopColor="#515BD4" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        <div className="space-y-3 border-b border-white/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-white">Threads</h3>
              <p className="text-xs text-white/40">
                {baseThreads.length.toLocaleString()} conversations
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    showThreadNames ? "Search threads…" : "Search by folder…"
                  }
                  className="rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-xs text-white placeholder:text-white/30 outline-none focus:border-[#DD2A7B]/40"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as DmSortKey)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none"
              >
                <option value="messages">Most messages</option>
                <option value="recent">Recent activity</option>
                <option value="oldest">Oldest first message</option>
                <option value="links">Most shared links</option>
                <option value="groups">Group chats first</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-white/60">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showThreadNames}
                onChange={(e) => setShowThreadNames(e.target.checked)}
                className="accent-[#DD2A7B]"
              />
              Show thread names
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showFirstMessagePreview}
                onChange={(e) => setShowFirstMessagePreview(e.target.checked)}
                className="accent-amber-500"
              />
              Show first message previews
            </label>
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {paged.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-white/40">
              No threads match your search.
            </div>
          ) : (
            paged.map((thread) => {
              const isOpen = expandedThreadId === thread.id;
              const accountKey = dmAccountKeyByThreadId?.get(thread.id);
              const canOpenAccount =
                Boolean(onOpenAccount) &&
                Boolean(accountKey) &&
                isDirectDmThread(thread);
              return (
                <div key={thread.id}>
                  <div className="flex w-full items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]">
                    <button
                      type="button"
                      onClick={() => toggleExpand(thread.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate font-medium text-white">
                        {canOpenAccount ? (
                          <span
                            role="link"
                            tabIndex={0}
                            className="hover:text-[#DD2A7B]"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenAccount?.({
                                threadId: thread.id,
                                accountKey: accountKey!,
                              });
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                onOpenAccount?.({
                                  threadId: thread.id,
                                  accountKey: accountKey!,
                                });
                              }
                            }}
                          >
                            {thread.displayTitle}
                          </span>
                        ) : (
                          thread.displayTitle
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-white/40">
                        {formatNumber(thread.totalMessages)} messages ·{" "}
                        {thread.folder.replace("_", " ")} ·{" "}
                        {thread.lastMessageAt
                          ? `Last active ${formatDate(thread.lastMessageAt)}`
                          : "Last active not available"}
                      </p>
                      <p className="mt-1 truncate text-xs italic text-white/35">
                        {thread.funSummary}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExpand(thread.id)}
                      className="shrink-0 text-white/40"
                      aria-label={isOpen ? "Collapse thread" : "Expand thread"}
                    >
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {isOpen && (
                    <ThreadExpandedPanel
                      thread={thread}
                      showThreadNames={showThreadNames}
                      showFirstMessagePreview={showFirstMessagePreview}
                      showParticipants={participantsOpen.has(thread.id)}
                      onToggleParticipants={() => toggleParticipants(thread.id)}
                      aiSummary={dmAiSummaries[thread.id]}
                      onAiSummaryChange={handleAiSummaryChange}
                      isLoadedFromCloud={isLoadedFromCloud}
                      relationship={dmRelationshipInsights.find(
                        (r) => r.threadId === thread.id
                      )}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {sorted.length > 0 && (
          <DmThreadPagination
            total={sorted.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        )}
      </div>

      <DmHeatmapSection heatmap={dmHeatmap} />

      {replyPatterns?.available && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <h3 className="font-semibold text-white">Reply patterns</h3>
          <p className="mt-1 text-xs text-white/40">
            Reply times are estimated from export timestamps. Gaps over 7 days
            are excluded from averages.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {replyPatterns.fastestResponder && (
              <MiniStat
                label="Fastest responder"
                value={`${replyPatterns.fastestResponder.label} (~${Math.round(replyPatterns.fastestResponder.avgMs / 60000)}m)`}
              />
            )}
            {replyPatterns.slowestResponder && (
              <MiniStat
                label="Slowest responder"
                value={`${replyPatterns.slowestResponder.label} (~${Math.round(replyPatterns.slowestResponder.avgMs / 60000)}m)`}
              />
            )}
            {replyPatterns.longestGhostGap && (
              <MiniStat
                label="Longest ghost gap"
                value={`${replyPatterns.longestGhostGap.label} (${replyPatterns.longestGhostGap.days}d)`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
