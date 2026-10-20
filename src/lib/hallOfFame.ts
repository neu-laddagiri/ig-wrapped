import type { InsightsBundle, HallOfFameAward } from "@/types/insights";
import type { ParsedExportData } from "@/types/instagram";
import {
  formatAccountDisplayName,
  UNKNOWN_ACCOUNT_LABEL,
} from "@/lib/accountNameFilter";
import { dmThreadSizes, isDmAwardMeaningful } from "@/lib/funStats";

const SHAME_DM_AWARDS = new Set(["slowest-responder", "one-sided"]);

/** Deleted/unknown accounts always look like ghosts, so they can't win ghost awards. */
export function isGhostAwardCandidate(account: {
  username: string;
  displayName: string;
  isUnknownAccount?: boolean;
}): boolean {
  if (account.isUnknownAccount) return false;
  if (account.username.toLowerCase().startsWith("unknown:")) return false;
  return formatAccountDisplayName(account.displayName) !== UNKNOWN_ACCOUNT_LABEL;
}

export function computeHallOfFame(
  parsed: ParsedExportData,
  bundle: Pick<
    InsightsBundle,
    | "accounts"
    | "cleanup"
    | "realOnes"
    | "silentMutuals"
    | "dmAwards"
    | "groupChats"
    | "leaderboards"
  >
): HallOfFameAward[] {
  const awards: HallOfFameAward[] = [];

  const topMutual = bundle.realOnes.find((r) => r.isMutual && r.dmMessageCount > 50);
  if (topMutual) {
    awards.push({
      id: "loyal-mutual",
      title: "Most Loyal Mutual",
      winnerLabel: formatAccountDisplayName(topMutual.displayName),
      winnerUsername: topMutual.username,
      why: `${topMutual.dmMessageCount.toLocaleString()} direct DMs and mutual follow status.`,
      confidence: "high",
      category: "fame",
    });
  }

  const ghostCandidate = [...bundle.accounts]
    .filter((a) => a.dmMessageCount > 30 && a.lastDmAt && isGhostAwardCandidate(a))
    .sort((a, b) => (a.lastDmAt ?? 0) - (b.lastDmAt ?? 0))[0];
  if (ghostCandidate) {
    awards.push({
      id: "biggest-ghost",
      title: "Biggest Ghost",
      winnerLabel: formatAccountDisplayName(ghostCandidate.displayName),
      winnerUsername: ghostCandidate.username,
      why: "High DM history but oldest last-active among top threads.",
      confidence: "low",
      category: "shame",
    });
  }

  const silentTop = bundle.silentMutuals[0];
  if (silentTop) {
    awards.push({
      id: "silent-hof",
      title: "Silent Mutual Hall of Fame",
      winnerLabel: formatAccountDisplayName(silentTop.displayName),
      winnerUsername: silentTop.username,
      why: "Mutual follow with no meaningful DM or interaction in export.",
      confidence: "medium",
      category: "shame",
    });
  }

  const threadSizes = dmThreadSizes(parsed.messages);
  for (const dm of bundle.dmAwards
    .filter((award) => isDmAwardMeaningful(award, threadSizes))
    .slice(0, 6)) {
    awards.push({
      id: `dm-award-${dm.id}`,
      title: dm.title,
      winnerLabel: formatAccountDisplayName(dm.threadLabel),
      why: dm.description,
      confidence: "high",
      category: SHAME_DM_AWARDS.has(dm.id) ? "shame" : "fame",
    });
  }

  const cleanupTop = bundle.cleanup
    .filter((c) => c.cleanupPriorityScore >= 60)
    .sort((a, b) => b.cleanupPriorityScore - a.cleanupPriorityScore)[0];
  if (cleanupTop) {
    awards.push({
      id: "instagram-npc",
      title: "Instagram NPC Award",
      winnerLabel: formatAccountDisplayName(cleanupTop.displayName),
      winnerUsername: cleanupTop.username,
      why: cleanupTop.recommendedAction,
      confidence: "medium",
      category: "shame",
    });
  }

  const randomMutual = bundle.cleanup.find(
    (c) => c.isMutual && c.dmMessageCount === 0 && c.cleanupPriorityScore > 40
  );
  if (randomMutual) {
    awards.push({
      id: "why-follow",
      title: "Why Do We Follow Each Other?",
      winnerLabel: formatAccountDisplayName(randomMutual.displayName),
      winnerUsername: randomMutual.username,
      why: "Mutual with little interaction — classic mystery connection.",
      confidence: "medium",
      category: "shame",
    });
  }

  const topGroup = [...bundle.groupChats].sort(
    (a, b) => b.totalMessages - a.totalMessages
  )[0];
  if (topGroup) {
    awards.push({
      id: "chaotic-group",
      title: "Most Chaotic Group Chat",
      winnerLabel: topGroup.title,
      why: `${topGroup.participantCount} people · ${topGroup.totalMessages.toLocaleString()} messages`,
      confidence: "high",
      category: "fame",
    });
  }

  const topAccount = bundle.leaderboards.find((b) => b.id === "top-accounts")?.entries[0];
  if (topAccount && !topAccount.username.startsWith("unknown:")) {
    awards.push({
      id: "unexpected-top",
      title: "Most Unexpected Top Account",
      winnerLabel: formatAccountDisplayName(topAccount.displayName),
      winnerUsername: topAccount.username,
      why: "Highest combined network + interaction score in your export.",
      confidence: "medium",
      category: "fame",
    });
  }

  const dontFollowBack = parsed.network?.dontFollowMeBack.length ?? 0;
  if (dontFollowBack > 20) {
    awards.push({
      id: "follow-back-ghost-energy",
      title: "Biggest Ghost Energy",
      winnerLabel: "Your following list",
      why: `${dontFollowBack} accounts don't follow you back.`,
      confidence: "medium",
      category: "shame",
    });
  }

  return awards;
}
