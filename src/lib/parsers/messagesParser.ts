import type { DmAnalytics, DmThreadAnalytics } from "@/types/instagram";
import { formatMonthKey, parseTimestamp } from "@/lib/formatters";

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

const REEL_PATTERN =
  /(?:https?:\/\/)?(?:www\.)?instagram\.com\/reels?\/|\/reels?\//gi;
const POST_PATTERN =
  /(?:https?:\/\/)?(?:www\.)?instagram\.com\/p\/|\/p\//gi;

export const DM_PARSER_VERSION = 3;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hashString(input: string): string {
  const normalized = input.replace(/\\/g, "/").toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `dm-${(h >>> 0).toString(36)}`;
}

function isDmMessageFile(path: string): boolean {
  const lower = path.toLowerCase().replace(/\\/g, "/");
  if (!lower.endsWith("message_1.json")) return false;
  if (!lower.includes("messages/")) return false;
  return lower.includes("/inbox/") || lower.includes("/message_requests/");
}

function getFolder(path: string): DmThreadAnalytics["folder"] {
  const lower = path.toLowerCase().replace(/\\/g, "/");
  if (lower.includes("/message_requests/")) return "message_requests";
  if (lower.includes("/inbox/")) return "inbox";
  return "other";
}

function extractParticipants(data: JsonRecord): string[] {
  const participants = data.participants;
  if (!Array.isArray(participants)) return [];
  return participants
    .map((p) => {
      if (!isRecord(p)) return null;
      const name = p.name;
      return typeof name === "string" && name.trim() ? name.trim() : null;
    })
    .filter((n): n is string => Boolean(n));
}

function threadTitle(
  data: JsonRecord,
  path: string,
  participants: string[]
): string {
  const title = data.title;
  if (typeof title === "string" && title.trim()) return title.trim();
  if (participants.length > 0) return participants.join(", ");
  const parts = path.replace(/\\/g, "/").split("/");
  const inboxIdx = parts.findIndex(
    (p) => p === "inbox" || p === "message_requests"
  );
  if (inboxIdx >= 0 && parts[inboxIdx + 1]) {
    return parts[inboxIdx + 1].replace(/_/g, " ");
  }
  return "Unknown thread";
}

function stableThreadId(
  data: JsonRecord,
  filePath: string,
  folder: string,
  index: number,
  title: string
): string {
  const threadPath = data.thread_path;
  if (typeof threadPath === "string" && threadPath.trim()) {
    return hashString(threadPath.trim());
  }
  const normalizedPath = filePath.replace(/\\/g, "/");
  if (normalizedPath) return hashString(normalizedPath);
  return hashString(`${folder}::${title}::${index}`);
}

function countUrlsInText(text: string): number {
  return (text.match(URL_REGEX) ?? []).length;
}

function countReelOrPostInText(text: string): number {
  if (!text.trim()) return 0;
  const reels = text.match(REEL_PATTERN)?.length ?? 0;
  const posts = text.match(POST_PATTERN)?.length ?? 0;
  return reels + posts;
}

function collectLinkableText(msg: JsonRecord): string[] {
  const parts: string[] = [];
  if (typeof msg.content === "string" && msg.content.trim()) {
    parts.push(msg.content);
  }
  if (isRecord(msg.share)) {
    if (typeof msg.share.share_text === "string" && msg.share.share_text.trim()) {
      parts.push(msg.share.share_text);
    }
    if (typeof msg.share.link === "string" && msg.share.link.trim()) {
      parts.push(msg.share.link);
    }
  }
  return parts;
}

function countMessageLinks(msg: JsonRecord): number {
  let count = 0;
  if (typeof msg.content === "string") {
    count += countUrlsInText(msg.content);
  }
  if (isRecord(msg.share)) {
    if (typeof msg.share.link === "string" && msg.share.link.trim()) {
      count += 1;
    }
    if (typeof msg.share.share_text === "string") {
      count += countUrlsInText(msg.share.share_text);
    }
  }
  return count;
}

function countMessageReelOrPost(msg: JsonRecord): number {
  return collectLinkableText(msg).reduce(
    (sum, text) => sum + countReelOrPostInText(text),
    0
  );
}

function extractFirstMessageText(msg: JsonRecord): string | undefined {
  if (typeof msg.content === "string" && msg.content.trim()) {
    return msg.content.trim();
  }
  if (isRecord(msg.share)) {
    if (
      typeof msg.share.share_text === "string" &&
      msg.share.share_text.trim()
    ) {
      return msg.share.share_text.trim();
    }
    if (typeof msg.share.link === "string" && msg.share.link.trim()) {
      return msg.share.link.trim();
    }
  }
  return undefined;
}

export function generateThreadFunSummary(thread: {
  messageCount: number;
  isGroupChat: boolean;
  messagesBySender: Record<string, number>;
  linkCount: number;
  reelOrPostCount: number;
  mediaCount: number;
  firstMessageTimestamp?: number;
}): string {
  const parts: string[] = [];

  if (thread.messageCount > 1000) parts.push("High-volume chat.");
  if (thread.isGroupChat) parts.push("Group chat energy.");

  const linkScore = thread.linkCount + thread.reelOrPostCount;
  if (linkScore >= 10) parts.push("Mostly a reels-and-links chat.");

  const senders = Object.entries(thread.messagesBySender).sort(
    (a, b) => b[1] - a[1]
  );
  if (senders.length >= 1 && thread.messageCount > 0) {
    const ratio = senders[0][1] / thread.messageCount;
    if (ratio > 0.65) parts.push("One person carries this conversation.");
  }

  if (thread.firstMessageTimestamp) {
    const years =
      (Date.now() / 1000 - thread.firstMessageTimestamp) / (86400 * 365);
    if (years >= 2) parts.push("Long-running chat.");
  }

  if (thread.mediaCount >= 15) parts.push("Media-heavy thread.");

  if (parts.length === 0) return "Steady back-and-forth.";
  return parts.slice(0, 2).join(" ");
}

function parseThread(
  path: string,
  data: JsonRecord,
  index: number
): DmThreadAnalytics | null {
  const participants = extractParticipants(data);
  const messages = data.messages;
  if (!Array.isArray(messages)) return null;

  const folder = getFolder(path);
  const title = threadTitle(data, path, participants);
  const threadPath =
    typeof data.thread_path === "string" ? data.thread_path : undefined;
  const id = stableThreadId(data, path, folder, index, title);

  const messagesBySender: Record<string, number> = {};
  const messagesByMonthMap = new Map<string, number>();
  const reelsLinksBySender: Record<string, number> = {};
  const postLinksBySender: Record<string, number> = {};

  let linkCount = 0;
  let reelOrPostCount = 0;
  let photoCount = 0;
  let videoCount = 0;
  let audioCount = 0;
  let reactionCount = 0;
  let callEventCount = 0;
  let totalTextLength = 0;
  let textMessageCount = 0;

  const timedMessages: {
    msg: JsonRecord;
    ts: number;
    sender: string;
  }[] = [];

  for (const raw of messages) {
    if (!isRecord(raw)) continue;

    const sender =
      typeof raw.sender_name === "string" ? raw.sender_name : "Unknown";
    messagesBySender[sender] = (messagesBySender[sender] ?? 0) + 1;

    const ts = parseTimestamp(raw.timestamp_ms);
    if (ts) {
      timedMessages.push({ msg: raw, ts, sender });
      const month = formatMonthKey(ts);
      messagesByMonthMap.set(month, (messagesByMonthMap.get(month) ?? 0) + 1);
    }

    if (typeof raw.content === "string" && raw.content.length > 0) {
      totalTextLength += raw.content.length;
      textMessageCount++;
    }

    linkCount += countMessageLinks(raw);
    const reelPost = countMessageReelOrPost(raw);
    reelOrPostCount += reelPost;
    if (reelPost > 0) {
      reelsLinksBySender[sender] =
        (reelsLinksBySender[sender] ?? 0) + reelPost;
    }

    if (Array.isArray(raw.photos)) photoCount += raw.photos.length;
    if (Array.isArray(raw.videos)) videoCount += raw.videos.length;
    if (Array.isArray(raw.audio_files)) audioCount += raw.audio_files.length;
    if (Array.isArray(raw.reactions)) reactionCount += raw.reactions.length;
    if (raw.call_duration !== undefined) callEventCount++;
  }

  timedMessages.sort((a, b) => a.ts - b.ts);

  const first = timedMessages[0];
  const last = timedMessages[timedMessages.length - 1];
  const firstMessageTimestamp = first?.ts;
  const lastMessageTimestamp = last?.ts;
  const firstMessageSender = first?.sender;
  const lastMessageSender = last?.sender;
  const firstMessagePreview = first
    ? extractFirstMessageText(first.msg)?.slice(0, 500)
    : undefined;

  const messagesByMonth = Array.from(messagesByMonthMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const mostActiveMonth = [...messagesByMonth].sort(
    (a, b) => b.count - a.count
  )[0]?.month;

  const participantCount = Math.max(participants.length, 1);
  const isGroupChat = participantCount > 2;
  const mediaCount = photoCount + videoCount + audioCount;
  const instagramReelLinks = reelOrPostCount;

  return {
    id,
    threadName: title,
    title,
    threadPath,
    sourcePath: path.replace(/\\/g, "/"),
    participants,
    participantCount,
    isGroupChat,
    messageCount: messages.length,
    folder,
    messagesBySender,
    firstMessageTimestamp,
    lastMessageTimestamp,
    firstMessageSender,
    lastMessageSender,
    firstMessagePreview,
    mostActiveMonth,
    messagesByMonth,
    avgMessageLength:
      textMessageCount > 0
        ? Math.round(totalTextLength / textMessageCount)
        : undefined,
    emojiCount: 0,
    linkCount,
    instagramReelLinks,
    instagramPostLinks: 0,
    instagramStoryLinks: 0,
    estimatedInstagramLinks: reelOrPostCount,
    reelOrPostCount,
    sharedMediaCount: mediaCount,
    photoCount,
    videoCount,
    audioCount,
    reactionCount,
    callEventCount,
    callCount: callEventCount,
    reelsLinksBySender,
    postLinksBySender,
    funSummary: generateThreadFunSummary({
      messageCount: messages.length,
      isGroupChat,
      messagesBySender,
      linkCount,
      reelOrPostCount,
      mediaCount,
      firstMessageTimestamp,
    }),
  };
}

export function parseMessages(files: Map<string, string>): DmAnalytics | null {
  const messageFiles: { path: string; content: string }[] = [];

  for (const [path, content] of files) {
    if (isDmMessageFile(path)) {
      messageFiles.push({ path, content });
    }
  }

  if (messageFiles.length === 0) return null;

  const threads: DmThreadAnalytics[] = [];
  const globalMonthCounts = new Map<string, number>();
  let totalMessages = 0;
  let inboxThreads = 0;
  let messageRequestThreads = 0;
  let groupChatCount = 0;
  let oneOnOneCount = 0;

  messageFiles.forEach(({ path, content }, index) => {
    try {
      const data = JSON.parse(content);
      if (!isRecord(data)) return;

      const thread = parseThread(path, data, index);
      if (!thread) return;

      totalMessages += thread.messageCount;
      if (thread.folder === "inbox") inboxThreads++;
      if (thread.folder === "message_requests") messageRequestThreads++;
      if (thread.isGroupChat) groupChatCount++;
      else oneOnOneCount++;

      for (const { month, count } of thread.messagesByMonth) {
        globalMonthCounts.set(month, (globalMonthCounts.get(month) ?? 0) + count);
      }

      threads.push(thread);
    } catch {
      // skip malformed thread files
    }
  });

  if (threads.length === 0) return null;

  const messagesByMonth = Array.from(globalMonthCounts.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const topThreads = [...threads]
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, 25);

  return {
    dmParserVersion: DM_PARSER_VERSION,
    totalThreads: threads.length,
    inboxThreads,
    messageRequestThreads,
    groupChatCount,
    oneOnOneCount,
    totalMessages,
    messagesByMonth,
    threads,
    topThreads,
  };
}
