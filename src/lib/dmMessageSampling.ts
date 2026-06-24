import type { DmMessageSample } from "@/types/instagram";
import { formatMonthKey, parseTimestamp } from "@/lib/formatters";

export interface SelectedMessageForApi {
  sender: string;
  timestamp_ms: number;
  text: string;
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

export function buildSenderLabels(
  senders: string[],
  isGroup: boolean
): Map<string, string> {
  const unique = [...new Set(senders.filter(Boolean))];
  const map = new Map<string, string>();

  if (isGroup) {
    unique.forEach((s, i) => map.set(s, `Person ${i + 1}`));
  } else if (unique.length >= 2) {
    map.set(unique[0], "User A");
    map.set(unique[1], "User B");
    for (let i = 2; i < unique.length; i++) {
      map.set(unique[i], `Person ${i + 1}`);
    }
  } else if (unique.length === 1) {
    map.set(unique[0], "User A");
  } else {
    unique.forEach((s, i) => map.set(s, `Person ${i + 1}`));
  }

  return map;
}

type TextMessage = DmMessageSample & { text: string };

export function prepareSelectedMessages(
  textMessages: DmMessageSample[],
  mostActiveMonth: string | undefined,
  isGroup: boolean
): SelectedMessageForApi[] {
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
    isGroup
  );

  const seen = new Set<string>();
  const merged: SelectedMessageForApi[] = [];

  for (const m of [...first20, ...activeMonthMsgs, ...last30]) {
    const key = `${m.timestamp_ms}:${m.sender_name}:${m.text.slice(0, 48)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    merged.push({
      sender: labels.get(m.sender_name) ?? "User",
      timestamp_ms: m.timestamp_ms,
      text: maskSensitiveText(m.text).slice(0, MAX_MESSAGE_CHARS),
    });

    if (merged.length >= MAX_MESSAGES) break;
  }

  return merged;
}

export function anonymizeSenderStats(
  messagesBySender: Record<string, number>,
  isGroup: boolean
): Record<string, number> {
  const senders = Object.keys(messagesBySender);
  const labels = buildSenderLabels(senders, isGroup);
  const result: Record<string, number> = {};
  for (const [name, count] of Object.entries(messagesBySender)) {
    const label = labels.get(name) ?? "User";
    result[label] = (result[label] ?? 0) + count;
  }
  return result;
}
