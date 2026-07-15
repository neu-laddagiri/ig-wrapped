import type { DmMessageSample, DmAiSummarySample } from "@/types/instagram";
import { formatMonthKey, parseTimestamp } from "@/lib/formatters";

export interface SelectedMessageForApi {
  sender: string;
  timestamp_ms: number;
  text: string;
}

export interface SamplingOptions {
  mostActiveMonth?: string;
  useRealNames: boolean;
}

const MAX_MESSAGES = 100;
const MAX_MESSAGE_CHARS = 500;

export function maskSensitiveText(text: string): string {
  return text
    .replace(/\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi, "[email]")
    .replace(
      /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      "[phone]"
    );
}

function messageText(msg: DmMessageSample): string | null {
  if (msg.content?.trim()) return msg.content.trim();
  if (msg.share_text?.trim()) return msg.share_text.trim();
  if (msg.share_link?.trim()) return msg.share_link.trim();
  return null;
}

function monthKeyFromTimestampMs(timestamp_ms: number): string | undefined {
  const ts = parseTimestamp(timestamp_ms);
  if (!ts) return undefined;
  return formatMonthKey(ts);
}

/** Build sender label map: real names or Person 1 / Person 2 / … */
export function buildSenderLabels(
  senders: string[],
  useRealNames: boolean
): Map<string, string> {
  const unique = [...new Set(senders.filter(Boolean))];
  const map = new Map<string, string>();

  if (useRealNames) {
    unique.forEach((s) => map.set(s, s));
    return map;
  }

  unique.forEach((s, i) => map.set(s, `Person ${i + 1}`));
  return map;
}

type TextMessage = DmMessageSample & { text: string };

export function prepareSelectedMessages(
  textMessages: DmMessageSample[],
  options: SamplingOptions
): SelectedMessageForApi[] {
  const { mostActiveMonth, useRealNames } = options;
  if (!textMessages.length) return [];

  const withText: TextMessage[] = textMessages
    .map((m) => {
      const text = messageText(m);
      return text ? { ...m, text } : null;
    })
    .filter((m): m is TextMessage => m !== null)
    .sort((a, b) => a.timestamp_ms - b.timestamp_ms);

  if (withText.length === 0) return [];

  const first20 = withText.slice(0, 20);
  const last30 = withText.slice(-30);

  let activeMonthMsgs: TextMessage[] = [];
  if (mostActiveMonth) {
    activeMonthMsgs = withText
      .filter((m) => monthKeyFromTimestampMs(m.timestamp_ms) === mostActiveMonth)
      .slice(0, 50);
  }

  const labels = buildSenderLabels(
    withText.map((m) => m.sender_name),
    useRealNames
  );

  const seen = new Set<string>();
  const merged: SelectedMessageForApi[] = [];

  for (const m of [...first20, ...activeMonthMsgs, ...last30]) {
    const key = `${m.timestamp_ms}:${m.sender_name}:${m.text.slice(0, 48)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    merged.push({
      sender: labels.get(m.sender_name) ?? (useRealNames ? m.sender_name : "Person"),
      timestamp_ms: m.timestamp_ms,
      text: maskSensitiveText(m.text).slice(0, MAX_MESSAGE_CHARS),
    });

    if (merged.length >= MAX_MESSAGES) break;
  }

  return merged;
}

export function formatSenderStats(
  messagesBySender: Record<string, number>,
  useRealNames: boolean
): Record<string, number> {
  const senders = Object.keys(messagesBySender);
  const labels = buildSenderLabels(senders, useRealNames);
  const result: Record<string, number> = {};
  for (const [name, count] of Object.entries(messagesBySender)) {
    const label = labels.get(name) ?? name;
    result[label] = (result[label] ?? 0) + count;
  }
  return result;
}

/** Display label for UI message balance chips */
import { formatAccountDisplayName } from "@/lib/accountNameFilter";

export function displaySenderLabel(
  rawName: string,
  labelMap: Map<string, string>
): string {
  const label = labelMap.get(rawName) ?? rawName;
  if (/^Person \d+$/.test(label)) return label;
  return formatAccountDisplayName(label);
}

export function buildSenderLabelMap(
  messagesBySender: Record<string, number>,
  useRealNames: boolean
): Map<string, string> {
  return buildSenderLabels(Object.keys(messagesBySender), useRealNames);
}

/** @deprecated Use formatSenderStats */
export function anonymizeSenderStats(
  messagesBySender: Record<string, number>,
  _isGroup: boolean
): Record<string, number> {
  void _isGroup;
  return formatSenderStats(messagesBySender, false);
}

function messageKey(timestamp_ms: number, text: string): string {
  return `${timestamp_ms}:${text.slice(0, 48)}`;
}

/** Build sanitized sample for cloud save */
export function buildAiSummarySampleForCloud(
  textMessages: DmMessageSample[],
  opts: {
    mostActiveMonth?: string;
    isGroup: boolean;
    showThreadNames: boolean;
  }
): DmAiSummarySample | undefined {
  const anonymized = prepareSelectedMessages(textMessages, {
    mostActiveMonth: opts.mostActiveMonth,
    useRealNames: false,
  });
  if (!anonymized.length) return undefined;

  const withRealNames = prepareSelectedMessages(textMessages, {
    mostActiveMonth: opts.mostActiveMonth,
    useRealNames: true,
  });
  const realByKey = new Map(
    withRealNames.map((m) => [messageKey(m.timestamp_ms, m.text), m.sender])
  );

  const hasRealNames = textMessages.some((m) => m.sender_name?.trim());

  return {
    createdAt: new Date().toISOString(),
    realNamesAvailable: hasRealNames,
    messages: anonymized.map((m) => {
      const key = messageKey(m.timestamp_ms, m.text);
      const senderName = realByKey.get(key);
      return {
        senderLabel: m.sender,
        senderName:
          opts.showThreadNames && senderName ? senderName : undefined,
        timestamp_ms: m.timestamp_ms,
        text: m.text,
      };
    }),
  };
}

/** Resolve AI-ready messages from live text or cloud-saved sample */
export function resolveAiReadyMessages(
  thread: {
    textMessages?: DmMessageSample[];
    aiSummarySample?: DmAiSummarySample;
    mostActiveMonth?: string;
    isGroup: boolean;
  },
  useRealNames: boolean
): SelectedMessageForApi[] {
  if (thread.textMessages?.length) {
    return prepareSelectedMessages(thread.textMessages, {
      mostActiveMonth: thread.mostActiveMonth,
      useRealNames,
    });
  }

  const sample = thread.aiSummarySample?.messages;
  if (!sample?.length) return [];

  return sample.map((m) => ({
    sender:
      useRealNames &&
      thread.aiSummarySample?.realNamesAvailable &&
      m.senderName
        ? m.senderName
        : m.senderLabel,
    timestamp_ms: m.timestamp_ms ?? 0,
    text: m.text,
  }));
}

export function threadHasAiSample(thread: {
  textMessages?: DmMessageSample[];
  aiSummarySample?: DmAiSummarySample;
}): boolean {
  return (
    (thread.textMessages?.length ?? 0) > 0 ||
    (thread.aiSummarySample?.messages?.length ?? 0) > 0
  );
}
