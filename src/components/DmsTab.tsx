"use client";

import {
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  AlertTriangle,
  ChevronLeft,
  Eye,
  EyeOff,
  MessageCircle,
  Search,
  Sparkles,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { DmAnalytics } from "@/types/instagram";
import type { DmAiSummariesMap, DmAiSummarySaved } from "@/types/dmAiSummary";
import type {
  DmHeatmapResult,
  DmRelationshipInsight,
  GroupChatInsight,
  ReplyPatternResult,
} from "@/types/insights";
import type { AccountReceiptTarget } from "@/lib/canonicalAccounts";
import { formatMonthLabel, formatNumber, formatTimestamp } from "@/lib/formatters";
import {
  dmCount,
  filterDmThreads,
  hasModernDmParser,
  isDirectDmThread,
  normalizeDmThreadList,
  normalizeMessagesByMonth,
  sortDmThreads,
  withDisplayTitles,
  type DmSortKey,
  type NormalizedDmThread,
} from "@/lib/dmThreads";
import { formatAccountDisplayName, isInstagramPlaceholderName } from "@/lib/accountNameFilter";
import { buildSenderLabelMap, displaySenderLabel } from "@/lib/dmMessageSampling";
import { redactNameLabel } from "@/lib/dmDisplayLabels";
import { computeConversationChemistry } from "@/lib/conversationChemistry";
import { plural } from "@/lib/profileOwner";
import { usePresentationMode } from "@/contexts/PresentationContext";
import { Avatar } from "@/components/ig/Avatar";
import { DmAiSummarySection } from "@/components/DmAiSummarySection";
import { DmHeatmapSection } from "@/components/DmHeatmapSection";
import { DmRelationshipTimeline } from "@/components/DmRelationshipTimeline";
import { ConversationChemistryPanel } from "@/components/ConversationChemistryPanel";

interface DmsTabProps {
  messages: DmAnalytics | null;
  showThreadNames?: boolean;
  onShowThreadNamesChange?: (value: boolean) => void;
  showFirstMessagePreview?: boolean;
  onShowFirstMessagePreviewChange?: (value: boolean) => void;
  dmAiSummaries?: DmAiSummariesMap;
  /** Accepts a value or an updater (pass the state setter). */
  onDmAiSummariesChange?: Dispatch<SetStateAction<DmAiSummariesMap>>;
  isLoadedFromCloud?: boolean;
  dmHeatmap?: DmHeatmapResult | null;
  replyPatterns?: ReplyPatternResult | null;
  dmRelationshipInsights?: DmRelationshipInsight[];
  groupChats?: GroupChatInsight[];
  onOpenAccount?: (target: AccountReceiptTarget) => void;
  dmAccountKeyByThreadId?: Map<string, string>;
  /** Shown at the top of the inbox list, like your username on Instagram. */
  ownerHandle?: string;
  /** Notices (demo, presenting…) shown above the inbox overview. */
  notices?: ReactNode;
}

const OVERVIEW = "__overview";
const LIST_BATCH = 60;

function formatDuration(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `~${hours}h`;
  return `~${Math.round(hours / 24)}d`;
}

function formatDate(ts?: number): string {
  if (!ts) return "Not available";
  const formatted = formatTimestamp(ts);
  return formatted === "—" ? "Not available" : formatted;
}

/** Instagram's short relative time: 5m, 3h, 2d, 6w, 1y. */
function shortAgo(ts?: number): string {
  if (!ts) return "";
  const seconds = Math.max(0, Date.now() / 1000 - ts);
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  if (seconds < 86400 * 7) return `${Math.round(seconds / 86400)}d`;
  if (seconds < 86400 * 364) return `${Math.round(seconds / (86400 * 7))}w`;
  return `${Math.round(seconds / (86400 * 365))}y`;
}

function senderLabel(rawName: string, labelMap: Map<string, string>, showNames: boolean): string {
  if (!showNames) return displaySenderLabel(rawName, labelMap);
  return formatAccountDisplayName(rawName);
}

function ThreadAvatar({ thread, size }: { thread: NormalizedDmThread; size: number }) {
  if (!thread.isGroup) return <Avatar size={size} />;
  const inner = Math.round(size * 0.72);
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }} aria-hidden>
      <span className="absolute right-0 top-0">
        <Avatar size={inner} />
      </span>
      <span className="absolute bottom-0 left-0 rounded-full ring-2 ring-ig-bg">
        <Avatar size={inner} />
      </span>
    </span>
  );
}

/** Messages, laid out like the Instagram inbox: chats on the left, insights on the right. */
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
  groupChats = [],
  onOpenAccount,
  dmAccountKeyByThreadId,
  ownerHandle,
  notices,
}: DmsTabProps) {
  const [internalShow, setInternalShow] = useState(true);
  const [internalPreview, setInternalPreview] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<DmSortKey>("recent");
  const [limit, setLimit] = useState(LIST_BATCH);
  const { presentationMode } = usePresentationMode();

  const showThreadNames = controlledShow ?? internalShow;
  const setShowThreadNames = onShowThreadNamesChange ?? setInternalShow;
  const showFirstMessagePreview = controlledPreview ?? internalPreview;
  const setShowFirstMessagePreview = onShowFirstMessagePreviewChange ?? setInternalPreview;
  // A typed query can be a name, so it is neither shown nor applied while presenting.
  const activeSearch = presentationMode ? "" : search;

  const baseThreads = useMemo(() => normalizeDmThreadList(messages), [messages]);
  const displayThreads = useMemo(
    () => withDisplayTitles(baseThreads, showThreadNames),
    [baseThreads, showThreadNames]
  );
  const sorted = useMemo(
    () => sortDmThreads(filterDmThreads(displayThreads, activeSearch, showThreadNames), sortBy),
    [displayThreads, activeSearch, showThreadNames, sortBy]
  );

  const needsReupload =
    baseThreads.length > 0 &&
    !hasModernDmParser(messages) &&
    baseThreads.filter((t) => t.hasDetailedInsights).length < Math.max(1, baseThreads.length * 0.5);

  const hasMessageData =
    messages &&
    (baseThreads.length > 0 ||
      dmCount(messages, "totalMessages") > 0 ||
      dmCount(messages, "totalThreads") > 0);

  if (!hasMessageData) {
    return (
      <div className="px-4 py-24 text-center">
        <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-2 border-fg">
          <MessageCircle className="h-12 w-12" strokeWidth={1.4} />
        </span>
        <h2 className="mt-4 text-xl">No messages found</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ig-muted">
          DM files from <code>your_instagram_activity/messages/</code> weren&apos;t in this export.
        </p>
      </div>
    );
  }

  const selected =
    selectedId && selectedId !== OVERVIEW
      ? displayThreads.find((t) => t.id === selectedId) ?? null
      : null;
  const paneOpen = selectedId !== null;

  const handleAiSummaryChange = (threadId: string, summary: DmAiSummarySaved | null) => {
    if (!onDmAiSummariesChange) return;
    // Functional update: two summaries finishing out of order must not drop one.
    onDmAiSummariesChange((prev) => {
      const next = { ...prev };
      if (summary) next[threadId] = summary;
      else delete next[threadId];
      return next;
    });
  };

  const requests = dmCount(messages, "messageRequestThreads");

  return (
    <div className="flex h-[calc(100dvh-110px)] md:h-screen">
      {/* Inbox list */}
      <aside
        className={`${paneOpen ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-ig-border md:w-[350px] xl:w-[397px]`}
      >
        <div className="px-6 pb-3 pt-6 md:pt-9">
          <div className="flex items-center justify-between gap-3">
            <h1 className="truncate text-xl font-bold">{ownerHandle ?? "Messages"}</h1>
            <button
              type="button"
              onClick={() => setShowThreadNames(!showThreadNames)}
              disabled={presentationMode}
              aria-pressed={!showThreadNames}
              title={presentationMode ? "Names stay hidden while presenting" : showThreadNames ? "Hide chat names" : "Show chat names"}
              className="rounded-full p-2 hover:bg-ig-hover disabled:opacity-40"
            >
              {showThreadNames ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              <span className="sr-only">{showThreadNames ? "Hide chat names" : "Show chat names"}</span>
            </button>
          </div>

          <label className="relative mt-4 flex items-center">
            <span className="sr-only">Search chats</span>
            <Search className="pointer-events-none absolute left-3 h-4 w-4 text-ig-muted" aria-hidden />
            <input
              type="text"
              value={activeSearch}
              disabled={presentationMode}
              onChange={(e) => {
                setSearch(e.target.value);
                setLimit(LIST_BATCH);
              }}
              placeholder={presentationMode ? "Search is off while presenting" : "Search"}
              className="h-9 w-full rounded-lg bg-ig-secondary pl-9 pr-3 text-sm outline-none placeholder:text-ig-muted disabled:opacity-60"
            />
          </label>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="font-bold">Messages</span>
            <select
              value={sortBy}
              aria-label="Sort chats"
              onChange={(e) => setSortBy(e.target.value as DmSortKey)}
              className="bg-transparent text-sm font-semibold text-ig-muted outline-none"
            >
              <option value="recent">Recent</option>
              <option value="messages">Most messages</option>
              <option value="oldest">Oldest</option>
              <option value="links">Most links</option>
              <option value="groups">Groups first</option>
            </select>
          </div>
          {requests > 0 && (
            <p className="mt-1 text-xs text-ig-muted">{plural(requests, "message request")} in your export</p>
          )}
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto pb-4">
          <li>
            <button
              type="button"
              onClick={() => setSelectedId(OVERVIEW)}
              aria-current={selectedId === OVERVIEW ? "true" : undefined}
              className={`flex w-full items-center gap-3 px-6 py-2 text-left hover:bg-ig-hover ${
                selectedId === OVERVIEW ? "bg-ig-hover" : ""
              }`}
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ig-gradient text-white">
                <Sparkles className="h-6 w-6" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-sm font-semibold">Inbox insights</span>
                <span className="block truncate text-xs text-ig-muted">
                  {formatNumber(dmCount(messages, "totalMessages"))} messages · heatmap · reply speed
                </span>
              </span>
            </button>
          </li>
          {sorted.slice(0, limit).map((thread) => {
            const isActive = thread.id === selectedId;
            return (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(thread.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={`flex w-full items-center gap-3 px-6 py-2 text-left hover:bg-ig-hover ${
                    isActive ? "bg-ig-hover" : ""
                  }`}
                >
                  <ThreadAvatar thread={thread} size={56} />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm">{thread.displayTitle}</span>
                    <span className="mt-0.5 block truncate text-xs text-ig-muted">
                      {plural(thread.totalMessages, "message")}
                      {thread.lastMessageAt ? ` · ${shortAgo(thread.lastMessageAt)}` : ""}
                      {thread.folder === "message_requests" ? " · request" : ""}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {sorted.length === 0 && (
            <li className="px-6 py-10 text-center text-sm text-ig-muted">No chats match your search.</li>
          )}
          {sorted.length > limit && (
            <li className="px-6 pt-2">
              <button
                type="button"
                onClick={() => setLimit((n) => n + LIST_BATCH)}
                className="w-full rounded-lg py-2 text-sm font-semibold text-ig-blue hover:bg-ig-hover"
              >
                Show {formatNumber(Math.min(LIST_BATCH, sorted.length - limit))} more
              </button>
            </li>
          )}
        </ul>
      </aside>

      {/* Conversation pane */}
      <section className={`${paneOpen ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {selected ? (
          <ThreadPane
            key={selected.id}
            thread={selected}
            onBack={() => setSelectedId(null)}
            showThreadNames={showThreadNames}
            showFirstMessagePreview={showFirstMessagePreview}
            onTogglePreview={setShowFirstMessagePreview}
            presenting={presentationMode}
            aiSummary={dmAiSummaries[selected.id]}
            onAiSummaryChange={handleAiSummaryChange}
            isLoadedFromCloud={isLoadedFromCloud}
            relationship={dmRelationshipInsights.find((r) => r.threadId === selected.id)}
            group={groupChats.find((g) => g.threadId === selected.id)}
            accountKey={dmAccountKeyByThreadId?.get(selected.id)}
            onOpenAccount={onOpenAccount}
          />
        ) : (
          <InboxOverview
            messages={messages}
            threadCount={baseThreads.length}
            dmHeatmap={dmHeatmap}
            replyPatterns={replyPatterns}
            showNames={showThreadNames}
            needsReupload={needsReupload}
            notices={notices}
            onBack={selectedId === OVERVIEW ? () => setSelectedId(null) : undefined}
          />
        )}
      </section>
    </div>
  );
}

function PaneHeader({
  onBack,
  children,
}: {
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex h-[75px] shrink-0 items-center gap-3 border-b border-ig-border px-4">
      {onBack && (
        <button type="button" onClick={onBack} aria-label="Back to chats" className="rounded-full p-1 hover:bg-ig-hover md:hidden">
          <ChevronLeft className="h-7 w-7" />
        </button>
      )}
      {children}
    </div>
  );
}

function InboxOverview({
  messages,
  threadCount,
  dmHeatmap,
  replyPatterns,
  showNames,
  needsReupload,
  notices,
  onBack,
}: {
  messages: DmAnalytics | null;
  threadCount: number;
  dmHeatmap?: DmHeatmapResult | null;
  replyPatterns?: ReplyPatternResult | null;
  showNames: boolean;
  needsReupload: boolean;
  notices?: ReactNode;
  onBack?: () => void;
}) {
  const chartData = normalizeMessagesByMonth(messages).map((m) => ({ month: m.month, messages: m.count }));
  const chats = dmCount(messages, "oneOnOneCount");
  const groups = dmCount(messages, "groupChatCount");
  const total = dmCount(messages, "totalMessages");
  const mask = (label: string) => (label === "You" ? label : redactNameLabel(label, showNames));

  return (
    <>
      <PaneHeader onBack={onBack}>
        <p className="text-base font-semibold">Inbox insights</p>
      </PaneHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[640px] px-4 py-8">
          {notices}
          <div className="text-center">
            <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border-2 border-fg">
              <MessageCircle className="h-12 w-12" strokeWidth={1.4} />
            </span>
            <h2 className="mt-4 text-xl">Your messages</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ig-muted">
              {formatNumber(total)} messages across {plural(chats || threadCount, "chat")} and{" "}
              {plural(groups, "group chat")}. Pick a chat to see who carries it.
            </p>
          </div>

          {needsReupload && (
            <p className="mt-6 flex items-start gap-2 rounded-lg border border-ig-border px-3 py-2.5 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ig-warn" />
              Re-upload your ZIP for detailed per-chat stats — this save predates the newer DM parser.
            </p>
          )}

          {chartData.length > 1 && (
            <section className="mt-8 rounded-xl border border-ig-border p-4">
              <h3 className="font-semibold">Messages by month</h3>
              <div className="mt-3 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <defs>
                      <linearGradient id="dmBars" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ff0069" />
                        <stop offset="100%" stopColor="#7638fa" />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "var(--ig-muted)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--ig-hover)" }}
                      contentStyle={{
                        background: "var(--ig-elevated)",
                        border: "1px solid var(--ig-border)",
                        borderRadius: 8,
                        color: "var(--ig-text)",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="messages" fill="url(#dmBars)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          <div className="mt-4">
            <DmHeatmapSection heatmap={dmHeatmap} />
          </div>

          {replyPatterns?.available && (
            <section className="mt-4 rounded-xl border border-ig-border p-4">
              <h3 className="font-semibold">Reply speed</h3>
              <ul className="mt-2 divide-y divide-ig-border text-sm">
                {replyPatterns.fastestResponder && (
                  <Fact label="Fastest to reply" value={`${mask(replyPatterns.fastestResponder.label)} · ${formatDuration(replyPatterns.fastestResponder.avgMs)}`} />
                )}
                {replyPatterns.slowestResponder && (
                  <Fact label="Slowest to reply" value={`${mask(replyPatterns.slowestResponder.label)} · ${formatDuration(replyPatterns.slowestResponder.avgMs)}`} />
                )}
                {replyPatterns.longestGhostGap && (
                  <Fact label="Longest ghost" value={`${mask(replyPatterns.longestGhostGap.label)} · ${plural(replyPatterns.longestGhostGap.days, "day")}`} />
                )}
              </ul>
              <p className="mt-2 text-xs text-ig-muted">
                Estimated from message timestamps; gaps over 7 days don&apos;t count toward averages.
              </p>
            </section>
          )}

          <p className="mt-6 text-center text-xs text-ig-muted">
            Message stats are computed in your browser. AI summaries are optional and send only
            the chat you pick.
          </p>
        </div>
      </div>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-ig-muted">{label}</span>
      <span className="truncate text-right font-semibold">{value}</span>
    </li>
  );
}

function ThreadPane({
  thread,
  onBack,
  showThreadNames,
  showFirstMessagePreview,
  onTogglePreview,
  presenting,
  aiSummary,
  onAiSummaryChange,
  isLoadedFromCloud,
  relationship,
  group,
  accountKey,
  onOpenAccount,
}: {
  thread: NormalizedDmThread;
  onBack: () => void;
  showThreadNames: boolean;
  showFirstMessagePreview: boolean;
  onTogglePreview: (value: boolean) => void;
  presenting: boolean;
  aiSummary?: DmAiSummarySaved;
  onAiSummaryChange: (threadId: string, summary: DmAiSummarySaved | null) => void;
  isLoadedFromCloud?: boolean;
  relationship?: DmRelationshipInsight;
  group?: GroupChatInsight;
  accountKey?: string;
  onOpenAccount?: (target: AccountReceiptTarget) => void;
}) {
  const [showParticipants, setShowParticipants] = useState(false);
  const senderLabelMap = buildSenderLabelMap(thread.messagesBySender, showThreadNames);
  const senders = Object.entries(thread.messagesBySender).sort((a, b) => b[1] - a[1]);
  const chemistry = !thread.isGroup ? computeConversationChemistry(thread, relationship) : null;
  const canOpenAccount = Boolean(onOpenAccount && accountKey && isDirectDmThread(thread) && showThreadNames);
  const openProfile = () => onOpenAccount?.({ threadId: thread.id, accountKey: accountKey! });
  const subtitle = thread.isGroup ? `Group · ${thread.participantCount} people` : "Direct message";

  const shared = [
    ["🔗", thread.linkCount, "link"],
    ["🎬", thread.reelOrPostCount, "reel or post", "reels or posts"],
    ["📷", thread.photoCount, "photo"],
    ["🎥", thread.videoCount, "video"],
    ["🎙️", thread.audioCount, "voice note"],
    ["❤️", thread.reactionCount, "reaction"],
    ["📞", thread.callCount, "call"],
  ].filter(([, count]) => (count as number) > 0) as [string, number, string, string?][];

  return (
    <>
      <PaneHeader onBack={onBack}>
        <ThreadAvatar thread={thread} size={44} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-base font-semibold">{thread.displayTitle}</p>
          <p className="truncate text-xs text-ig-muted">{subtitle}</p>
        </div>
        {canOpenAccount && (
          <button type="button" onClick={openProfile} className="rounded-lg bg-ig-secondary px-4 py-1.5 text-sm font-semibold hover:bg-ig-hover">
            View profile
          </button>
        )}
      </PaneHeader>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[640px] px-4 pb-12 pt-8">
          <div className="flex flex-col items-center text-center">
            <ThreadAvatar thread={thread} size={96} />
            <p className="mt-3 text-xl font-semibold">{thread.displayTitle}</p>
            <p className="text-sm text-ig-muted">
              {plural(thread.totalMessages, "message")}
              {thread.firstMessageAt ? ` · since ${formatDate(thread.firstMessageAt)}` : ""}
            </p>
            {thread.hasDetailedInsights && (
              <p className="mt-3 max-w-md text-sm italic text-ig-muted">{thread.funSummary}</p>
            )}
            {showThreadNames && !thread.isGroup && isInstagramPlaceholderName(thread.title) && (
              <p className="mt-2 text-xs text-ig-muted">Instagram&apos;s export didn&apos;t include a usable name for this account.</p>
            )}
          </div>

          {!thread.hasDetailedInsights ? (
            <p className="mt-8 rounded-lg border border-ig-border px-4 py-3 text-sm text-ig-muted">
              Detailed stats aren&apos;t available for this chat. Re-upload your Instagram ZIP to refresh them.
            </p>
          ) : (
            <>
              <dl className="mt-8 grid grid-cols-3 divide-x divide-ig-border rounded-xl border border-ig-border text-center">
                <Stat label="Messages" value={formatNumber(thread.totalMessages)} />
                <Stat label="Last active" value={thread.lastMessageAt ? formatDate(thread.lastMessageAt) : "—"} />
                <Stat label="Busiest month" value={thread.mostActiveMonth ? formatMonthLabel(thread.mostActiveMonth) : "—"} />
              </dl>

              <Section title="AI chat summary">
                {presenting ? (
                  <p className="text-sm text-ig-muted">AI summaries are hidden while presenting.</p>
                ) : (
                  <DmAiSummarySection
                    thread={thread}
                    showThreadNames={showThreadNames}
                    saved={aiSummary}
                    onSummaryChange={onAiSummaryChange}
                    embedded
                    isLoadedFromCloud={isLoadedFromCloud}
                  />
                )}
              </Section>

              {senders.length > 0 && (
                <Section title="Who carries the chat">
                  <ul className="space-y-3">
                    {senders.slice(0, 8).map(([name, count]) => {
                      const pct = thread.totalMessages > 0 ? Math.round((count / thread.totalMessages) * 100) : 0;
                      return (
                        <li key={name}>
                          <div className="mb-1 flex justify-between gap-3 text-sm">
                            <span className="truncate">{senderLabel(name, senderLabelMap, showThreadNames)}</span>
                            <span className="shrink-0 text-ig-muted">
                              {formatNumber(count)} · {pct}%
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-ig-secondary">
                            <div className="h-full rounded-full bg-ig-gradient" style={{ width: `${Math.max(pct, 2)}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Section>
              )}

              {group && group.roles.length > 0 && (
                <Section title="Group roles">
                  <ul className="divide-y divide-ig-border">
                    {group.roles.slice(0, 10).map((role, i) => (
                      <li key={role.participant} className="flex items-center gap-3 py-2.5">
                        <Avatar size={36} />
                        <div className="min-w-0 flex-1 leading-tight">
                          <p className="truncate text-sm font-semibold">
                            {showThreadNames ? role.participant : `Person ${i + 1}`}
                          </p>
                          <p className="text-xs text-ig-muted">{role.role}</p>
                        </div>
                        <span className="shrink-0 text-xs text-ig-muted">{role.messageShare}%</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              {chemistry && (
                <div className="mt-8">
                  <ConversationChemistryPanel chemistry={chemistry} />
                </div>
              )}

              <Section title="Timeline">
                <DmRelationshipTimeline
                  thread={thread}
                  relationship={relationship}
                  showNames={showThreadNames}
                  showFirstMessagePreview={showFirstMessagePreview}
                  formatSender={(name) => senderLabel(name, senderLabelMap, showThreadNames)}
                />
              </Section>

              {shared.length > 0 && (
                <Section title="Shared in this chat">
                  <ul className="flex flex-wrap gap-2">
                    {shared.map(([emoji, count, singular, pluralForm]) => (
                      <li key={singular} className="rounded-full bg-ig-secondary px-3 py-1.5 text-sm">
                        {emoji} {plural(count, singular, pluralForm)}
                      </li>
                    ))}
                  </ul>
                </Section>
              )}

              <Section title="First message">
                <p className="text-sm">
                  {formatDate(thread.firstMessageAt)}
                  {thread.firstMessageSender && ` · from ${senderLabel(thread.firstMessageSender, senderLabelMap, showThreadNames)}`}
                </p>
                {!presenting && (
                  <label className="mt-2 flex items-center gap-2 text-sm text-ig-muted">
                    <input
                      type="checkbox"
                      checked={showFirstMessagePreview}
                      onChange={(e) => onTogglePreview(e.target.checked)}
                      className="accent-ig-blue"
                    />
                    Show message previews (may include private text)
                  </label>
                )}
                {showFirstMessagePreview && (
                  <p className="mt-3 inline-block max-w-full rounded-2xl bg-ig-secondary px-4 py-2 text-sm">
                    {thread.firstMessageText?.trim()
                      ? thread.firstMessageText.length > 200
                        ? `${thread.firstMessageText.slice(0, 200)}…`
                        : thread.firstMessageText
                      : "No text preview available."}
                  </p>
                )}
              </Section>

              {thread.isGroup && thread.participants.length > 0 && (
                <Section title="Members">
                  <button
                    type="button"
                    onClick={() => setShowParticipants((v) => !v)}
                    className="text-sm font-semibold text-ig-blue hover:text-ig-link"
                  >
                    {showParticipants ? "Hide members" : `Show ${thread.participants.length} members`}
                  </button>
                  {showParticipants && (
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {thread.participants.map((p, i) => (
                        <li key={`${p}-${i}`} className="rounded-full bg-ig-secondary px-3 py-1 text-sm">
                          {showThreadNames ? p : `Person ${i + 1}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-3">
      <dt className="text-xs text-ig-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h3 className="mb-3 text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}
