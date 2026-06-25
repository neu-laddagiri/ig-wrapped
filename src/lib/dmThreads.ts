import type { DmAnalytics, DmMessageSample, DmThreadAnalytics, DmAiSummarySample } from "@/types/instagram";
import { formatAccountDisplayName } from "@/lib/accountNameFilter";

/** Canonical DM thread shape for UI rendering */
export interface NormalizedDmThread {
  id: string;
  title: string;
  displayTitle: string;
  participants: string[];
  isGroup: boolean;
  participantCount: number;
  folder: "inbox" | "message_requests" | "unknown";
  totalMessages: number;
  messagesBySender: Record<string, number>;
  firstMessageAt?: number;
  lastMessageAt?: number;
  firstMessageSender?: string;
  firstMessageText?: string;
  lastMessageSender?: string;
  mostActiveMonth?: string;
  messagesByMonth: { month: string; messages: number }[];
  linkCount: number;
  reelOrPostCount: number;
  mediaCount: number;
  photoCount: number;
  videoCount: number;
  audioCount: number;
  reactionCount: number;
  callCount: number;
  averageMessageLength?: number;
  funSummary: string;
  /** True when thread has enough parsed metadata to show insights */
  hasDetailedInsights: boolean;
  /** Local-only message sample for optional AI summarization */
  textMessages?: DmMessageSample[];
  /** Sanitized sample restored from cloud save */
  aiSummarySample?: DmAiSummarySample;
}

export type DmSortKey =
  | "messages"
  | "recent"
  | "oldest"
  | "links"
  | "groups";

export const DM_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export type DmPageSize = (typeof DM_PAGE_SIZE_OPTIONS)[number];

type MessagesLike = Partial<DmAnalytics> & {
  dmThreads?: DmThreadAnalytics[];
  threadAnalytics?: DmThreadAnalytics[];
};

type RawThread = DmThreadAnalytics & {
  title?: string;
  sourcePath?: string;
  totalMessages?: number;
  isGroup?: boolean;
  firstMessageAt?: number;
  lastMessageAt?: number;
  firstMessageText?: string;
  lastMessageSender?: string;
  callCount?: number;
  reelOrPostCount?: number;
};

function hashString(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `dm-${(h >>> 0).toString(36)}`;
}

function rawThreadList(messages: MessagesLike | null | undefined): RawThread[] {
  if (!messages) return [];
  if (Array.isArray(messages.threads)) return messages.threads as RawThread[];
  if (Array.isArray(messages.dmThreads)) return messages.dmThreads as RawThread[];
  if (Array.isArray(messages.threadAnalytics))
    return messages.threadAnalytics as RawThread[];
  if (Array.isArray(messages.topThreads)) return messages.topThreads as RawThread[];
  return [];
}

function normalizeFolder(
  folder?: string
): NormalizedDmThread["folder"] {
  if (folder === "inbox") return "inbox";
  if (folder === "message_requests") return "message_requests";
  return "unknown";
}

export function generateDmFunSummary(t: {
  totalMessages: number;
  isGroup: boolean;
  messagesBySender: Record<string, number>;
  linkCount: number;
  reelOrPostCount: number;
  mediaCount: number;
  firstMessageAt?: number;
}): string {
  const parts: string[] = [];

  if (t.totalMessages > 1000) parts.push("High-volume chat.");
  if (t.isGroup) parts.push("Group chat energy.");

  const linkScore = t.linkCount + t.reelOrPostCount;
  if (linkScore >= 10) parts.push("Mostly a reels-and-links chat.");

  const senders = Object.entries(t.messagesBySender).sort((a, b) => b[1] - a[1]);
  if (senders.length >= 1 && t.totalMessages > 0) {
    const ratio = senders[0][1] / t.totalMessages;
    if (ratio > 0.65) parts.push("One person carries this conversation.");
  }

  if (t.firstMessageAt) {
    const years = (Date.now() / 1000 - t.firstMessageAt) / (86400 * 365);
    if (years >= 2) parts.push("Long-running chat.");
  }

  if (t.mediaCount >= 15) parts.push("Media-heavy thread.");

  return parts.length > 0 ? parts.slice(0, 2).join(" ") : "Steady back-and-forth.";
}

function threadHasDetailedInsights(raw: RawThread): boolean {
  const total = raw.totalMessages ?? raw.messageCount ?? 0;
  if (total === 0) return false;
  const hasTimestamps =
    (raw.firstMessageAt ?? raw.firstMessageTimestamp) != null ||
    (raw.lastMessageAt ?? raw.lastMessageTimestamp) != null;
  const hasSenders = Object.keys(raw.messagesBySender ?? {}).length > 0;
  return hasTimestamps && hasSenders;
}

function rawToNormalized(raw: RawThread, index: number): NormalizedDmThread {
  const title =
    raw.title ??
    raw.threadName ??
    (raw.participants?.length ? raw.participants.join(", ") : `Thread ${index + 1}`);

  const participantCount = Math.max(
    raw.participantCount ?? raw.participants?.length ?? 0,
    1
  );
  const isGroup =
    raw.isGroup ?? raw.isGroupChat ?? participantCount > 2;

  const folder = normalizeFolder(raw.folder);
  const messagesBySender = raw.messagesBySender ?? {};
  const totalMessages = raw.totalMessages ?? raw.messageCount ?? 0;
  const linkCount = raw.linkCount ?? 0;
  const reelOrPostCount =
    raw.reelOrPostCount ??
    (raw.instagramReelLinks ?? 0) + (raw.instagramPostLinks ?? 0);
  const photoCount = raw.photoCount ?? 0;
  const videoCount = raw.videoCount ?? 0;
  const audioCount = raw.audioCount ?? 0;
  const mediaCount =
    photoCount + videoCount + audioCount > 0
      ? photoCount + videoCount + audioCount
      : (raw.sharedMediaCount ?? 0);

  const firstMessageAt = raw.firstMessageAt ?? raw.firstMessageTimestamp;
  const lastMessageAt = raw.lastMessageAt ?? raw.lastMessageTimestamp;
  const firstMessageText =
    raw.firstMessageText ?? raw.firstMessagePreview;

  const threadPath = raw.threadPath;
  const sourcePath =
    raw.sourcePath ??
    (threadPath ? threadPath.replace(/\\/g, "/") : undefined) ??
    (raw.id && raw.id.includes("/") ? raw.id : undefined);

  let id: string;
  if (threadPath) {
    id = hashString(threadPath.replace(/\\/g, "/").toLowerCase());
  } else if (sourcePath) {
    id = hashString(sourcePath.toLowerCase());
  } else if (raw.id && raw.id.startsWith("dm-")) {
    id = raw.id;
  } else if (raw.id) {
    id = hashString(`${raw.id}-${folder}`);
  } else {
    id = hashString(`${folder}::${title}::${index}`);
  }

  const messagesByMonth = Array.isArray(raw.messagesByMonth)
    ? raw.messagesByMonth.map((m) => ({
        month: m.month,
        messages: "messages" in m && typeof m.messages === "number"
          ? m.messages
          : m.count,
      }))
    : [];

  const base: NormalizedDmThread = {
    id,
    title,
    displayTitle: "",
    participants: raw.participants ?? [],
    isGroup,
    participantCount,
    folder,
    totalMessages,
    messagesBySender,
    firstMessageAt,
    lastMessageAt,
    firstMessageSender: raw.firstMessageSender,
    firstMessageText,
    lastMessageSender: raw.lastMessageSender,
    mostActiveMonth: raw.mostActiveMonth,
    messagesByMonth,
    linkCount,
    reelOrPostCount,
    mediaCount,
    photoCount,
    videoCount,
    audioCount,
    reactionCount: raw.reactionCount ?? 0,
    callCount: raw.callCount ?? raw.callEventCount ?? 0,
    averageMessageLength: raw.avgMessageLength,
    funSummary:
      raw.funSummary ??
      generateDmFunSummary({
        totalMessages,
        isGroup,
        messagesBySender,
        linkCount,
        reelOrPostCount,
        mediaCount,
        firstMessageAt,
      }),
    hasDetailedInsights: threadHasDetailedInsights(raw),
    textMessages: raw.textMessages,
    aiSummarySample: raw.aiSummarySample,
  };

  base.displayTitle = computeDisplayTitle(base, false);
  return base;
}

function ensureUniqueIds(threads: NormalizedDmThread[]): NormalizedDmThread[] {
  const seen = new Map<string, number>();
  return threads.map((t) => {
    const count = seen.get(t.id) ?? 0;
    seen.set(t.id, count + 1);
    if (count === 0) return t;
    return { ...t, id: `${t.id}--${count}` };
  });
}

/** Normalize any saved/parser thread list into stable NormalizedDmThread[] */
export function normalizeDmThreadList(
  messages: MessagesLike | null | undefined
): NormalizedDmThread[] {
  const raw = rawThreadList(messages);
  return ensureUniqueIds(raw.map((r, i) => rawToNormalized(r, i)));
}

/** Whether saved analysis has v3 parser metadata */
export function hasModernDmParser(messages: MessagesLike | null | undefined): boolean {
  if (!messages) return false;
  if (messages.dmParserVersion != null && messages.dmParserVersion >= 3) return true;
  const threads = rawThreadList(messages);
  if (threads.length === 0) return false;
  const detailed = threads.filter(threadHasDetailedInsights);
  return detailed.length >= threads.length * 0.8;
}

/** @deprecated Use normalizeDmThreadList */
export function normalizeDmThreads(
  messages: MessagesLike | null | undefined
): DmThreadAnalytics[] {
  return rawThreadList(messages);
}

export function computeDisplayTitle(
  thread: NormalizedDmThread,
  showThreadNames: boolean
): string {
  if (!showThreadNames) {
    return thread.isGroup
      ? `Group chat · ${thread.participantCount} people`
      : "Private thread";
  }
  if (thread.isGroup) {
    return `Group chat · ${thread.participantCount} people`;
  }
  return formatAccountDisplayName(thread.title);
}

export function withDisplayTitles(
  threads: NormalizedDmThread[],
  showThreadNames: boolean
): NormalizedDmThread[] {
  return threads.map((t) => ({
    ...t,
    displayTitle: computeDisplayTitle(t, showThreadNames),
  }));
}

export function normalizeMessagesByMonth(
  messages: MessagesLike | null | undefined
): { month: string; count: number }[] {
  if (!messages || !Array.isArray(messages.messagesByMonth)) return [];
  return messages.messagesByMonth;
}

export function dmCount(
  messages: MessagesLike | null | undefined,
  key: keyof DmAnalytics,
  fallback = 0
): number {
  if (!messages) return fallback;
  const value = messages[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sortKey(value: number | undefined, missing: number): number {
  return value ?? missing;
}

export function sortDmThreads(
  threads: NormalizedDmThread[],
  sortBy: DmSortKey
): NormalizedDmThread[] {
  const list = [...threads];

  switch (sortBy) {
    case "recent":
      return list.sort(
        (a, b) =>
          sortKey(b.lastMessageAt, -Infinity) -
          sortKey(a.lastMessageAt, -Infinity)
      );
    case "oldest":
      return list.sort(
        (a, b) =>
          sortKey(a.firstMessageAt, Infinity) -
          sortKey(b.firstMessageAt, Infinity)
      );
    case "links":
      return list.sort(
        (a, b) =>
          b.linkCount + b.reelOrPostCount - (a.linkCount + a.reelOrPostCount)
      );
    case "groups":
      return list.sort((a, b) => {
        if (a.isGroup !== b.isGroup) return a.isGroup ? -1 : 1;
        return b.totalMessages - a.totalMessages;
      });
    case "messages":
    default:
      return list.sort((a, b) => b.totalMessages - a.totalMessages);
  }
}

export function filterDmThreads(
  threads: NormalizedDmThread[],
  query: string,
  showThreadNames: boolean
): NormalizedDmThread[] {
  const q = query.trim().toLowerCase();
  if (!q) return threads;

  return threads.filter((t) => {
    if (showThreadNames) {
      if (t.title.toLowerCase().includes(q)) return true;
      if (t.participants.some((p) => p.toLowerCase().includes(q))) return true;
    }
    if (t.folder.replace("_", " ").includes(q)) return true;
    if (String(t.totalMessages).includes(q)) return true;
    return false;
  });
}

export function paginateDmThreads<T>(
  items: T[],
  page: number,
  pageSize: number
): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
