import type { DmThreadAnalytics } from "@/types/instagram";
import type { DmAward } from "@/types/insights";
import { formatAccountDisplayName } from "@/lib/accountNameFilter";

export function formatDmThreadLabel(thread: DmThreadAnalytics): string {
  if (thread.isGroupChat) {
    return `Group · ${thread.participantCount} people`;
  }
  return formatAccountDisplayName(thread.threadName);
}

export function resolveDmAwardLabel(
  award: DmAward,
  showNames: boolean
): string {
  if (showNames) {
    return award.threadLabel === "••••••••"
      ? "Direct thread"
      : formatAccountDisplayName(award.threadLabel);
  }
  return "Hidden for sharing";
}

export function redactNameLabel(label: string, showNames: boolean): string {
  if (showNames) return formatAccountDisplayName(label);
  return "Hidden for sharing";
}
