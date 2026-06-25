import type { UnifiedAccount } from "@/types/insights";
import type { RealOnesAccount } from "@/types/insights";
import { formatAccountDisplayName } from "@/lib/accountNameFilter";

function attributableEngagement(account: UnifiedAccount): number {
  let total = 0;
  if (account.likesAttribution === "attributed") total += account.likedCount;
  if (account.commentsAttribution === "attributed") {
    total += account.commentedCount;
  }
  if (account.storiesAttribution === "attributed") {
    total += account.storyInteractionCount;
  }
  return total;
}

function buildRankReason(
  account: UnifiedAccount,
  score: number
): string {
  const parts: string[] = [];
  if (account.dmMessageCount > 0) {
    parts.push(`${account.dmMessageCount.toLocaleString()} direct DMs`);
  }
  if (account.isMutual) parts.push("mutual");
  if (account.lastDmAt) parts.push("recent direct DM");
  if (parts.length === 0) return `Relationship score ${score}`;
  return parts.join(" · ");
}

function computeScoreComponents(
  account: UnifiedAccount,
  maxDm: number,
  now: number
): {
  directDmScore: number;
  balanceScore: number;
  recencyScore: number;
  mutualBonus: number;
  engagementScore: number;
  realOnesScore: number;
} {
  const dmCount = account.dmMessageCount;
  const directDmScore =
    dmCount > 0
      ? Math.min(
          100,
          (Math.log10(dmCount + 1) / Math.log10(maxDm + 1)) * 100
        )
      : 0;

  const sentMe = account.dmSentByMe ?? 0;
  const sentThem = account.dmSentByThem ?? 0;
  const totalSent = sentMe + sentThem;
  const balanceScore =
    account.dmSenderSplitAvailable && totalSent > 0
      ? (1 - Math.abs(sentMe - sentThem) / totalSent) * 100
      : 50;

  let recencyScore = 0;
  if (account.lastDmAt) {
    const days = (now - account.lastDmAt) / 86400;
    if (days <= 7) recencyScore = 100;
    else if (days <= 30) recencyScore = 85;
    else if (days <= 90) recencyScore = 60;
    else if (days <= 365) recencyScore = 35;
    else recencyScore = 15;
  }

  const mutualBonus = account.isMutual
    ? 100
    : account.iFollowThem || account.followsMe
      ? 40
      : 0;

  const realOnesScore = Math.round(
    Math.min(
      100,
      directDmScore * 0.6 +
        balanceScore * 0.15 +
        recencyScore * 0.2 +
        mutualBonus * 0.05
    )
  );

  return {
    directDmScore,
    balanceScore,
    recencyScore,
    mutualBonus,
    engagementScore: 0,
    realOnesScore,
  };
}

export function computeRealOnesScores(
  accounts: UnifiedAccount[]
): RealOnesAccount[] {
  const now = Math.floor(Date.now() / 1000);
  const maxDm = Math.max(...accounts.map((a) => a.dmMessageCount), 1);

  return accounts
    .filter((a) => a.dmMessageCount > 0)
    .map((account) => {
      const engagement = attributableEngagement(account);
      const components = computeScoreComponents(account, maxDm, now);

      const isSilentMutual =
        account.isMutual &&
        account.dmMessageCount === 0 &&
        engagement === 0 &&
        (account.groupMessageCount ?? 0) < 2;

      return {
        username: account.username,
        displayName: formatAccountDisplayName(account.displayName),
        realOnesScore: components.realOnesScore,
        dmMessageCount: account.dmMessageCount,
        groupMessageCount: account.groupMessageCount,
        isMutual: account.isMutual,
        relationshipLabel: account.relationshipLabel,
        lastDmAt: account.lastDmAt,
        followBackTimeMs: account.followBackTimeMs,
        interactionScore: engagement,
        isSilentMutual,
        sourceBreakdown: account.sourceBreakdown,
        rankReason: buildRankReason(account, components.realOnesScore),
        scoreBreakdown: `DM ${Math.round(components.directDmScore)} · balance ${Math.round(components.balanceScore)} · recency ${Math.round(components.recencyScore)} · mutual ${Math.round(components.mutualBonus)}`,
      };
    })
    .filter((a) => !a.isSilentMutual)
    .sort((a, b) => {
      if (b.dmMessageCount !== a.dmMessageCount) {
        return b.dmMessageCount - a.dmMessageCount;
      }
      return b.realOnesScore - a.realOnesScore;
    });
}

export function computeSilentMutuals(
  accounts: UnifiedAccount[]
): RealOnesAccount[] {
  return accounts
    .filter(
      (a) =>
        a.isMutual &&
        a.dmMessageCount === 0 &&
        (a.groupMessageCount ?? 0) < 3 &&
        attributableEngagement(a) === 0 &&
        !a.isUnknownAccount
    )
    .map((a) => ({
      username: a.username,
      displayName: formatAccountDisplayName(a.displayName),
      realOnesScore: 0,
      dmMessageCount: 0,
      groupMessageCount: a.groupMessageCount ?? 0,
      isMutual: true,
      relationshipLabel: "Silent mutual" as const,
      lastDmAt: undefined,
      interactionScore: 0,
      isSilentMutual: true,
      rankReason: "Mutual follow only — no direct DMs or interactions in export",
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .slice(0, 25);
}

export const REAL_ONES_LEADERBOARDS = {
  topRealOnes: (accounts: RealOnesAccount[]) =>
    [...accounts]
      .filter((a) => !a.isSilentMutual && a.dmMessageCount > 0)
      .sort((a, b) => b.realOnesScore - a.realOnesScore)
      .slice(0, 20),
  mostActiveDm: (accounts: RealOnesAccount[]) =>
    [...accounts]
      .filter((a) => a.dmMessageCount > 0)
      .sort((a, b) => b.dmMessageCount - a.dmMessageCount)
      .slice(0, 20),
  silentMutuals: (accounts: RealOnesAccount[]) =>
    accounts
      .filter((a) => a.isSilentMutual)
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .slice(0, 20),
  longestConnections: (accounts: UnifiedAccount[]) =>
    [...accounts]
      .filter((a) => a.firstConnectedAt && !a.isUnknownAccount)
      .sort((a, b) => (a.firstConnectedAt ?? 0) - (b.firstConnectedAt ?? 0))
      .slice(0, 20)
      .map((a) => ({
        username: a.username,
        displayName: formatAccountDisplayName(a.displayName),
        realOnesScore: 0,
        dmMessageCount: a.dmMessageCount,
        groupMessageCount: a.groupMessageCount,
        isMutual: a.isMutual,
        relationshipLabel: a.relationshipLabel,
        lastDmAt: a.lastDmAt,
        interactionScore: 0,
        isSilentMutual: false,
        rankReason: "Longest network connection in export",
      })),
};
