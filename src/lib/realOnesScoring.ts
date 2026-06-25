import type { UnifiedAccount } from "@/types/insights";
import type { RealOnesAccount } from "@/types/insights";

const SILENT_MUTUAL_CAP = 35;

function hasMeaningfulInteraction(account: UnifiedAccount): boolean {
  return (
    account.dmMessageCount > 0 ||
    account.groupMessageCount >= 3 ||
    account.likedCount + account.commentedCount + account.storyInteractionCount >
      0
  );
}

export function computeRealOnesScores(
  accounts: UnifiedAccount[]
): RealOnesAccount[] {
  const now = Math.floor(Date.now() / 1000);
  const monthAgo = now - 30 * 24 * 60 * 60;

  return accounts
    .filter((a) => !a.isUnknownAccount || a.dmMessageCount > 0)
    .map((account) => {
      const interactionScore =
        account.likedCount + account.commentedCount + account.storyInteractionCount;

      let score = 0;

      // Direct DMs — strongest signal
      if (account.dmMessageCount > 0) {
        score += Math.min(42, Math.log10(account.dmMessageCount + 1) * 16);
      }

      // Recent direct DM activity
      if (account.lastDmAt && account.lastDmAt > monthAgo) {
        score += 18;
      }

      // Group messages actually sent — weaker
      if (account.groupMessageCount > 0) {
        score += Math.min(12, account.groupMessageCount / 15);
      }

      // Mutual — medium, not dominant
      if (account.isMutual) score += 12;

      // Story/like/comment tied to username
      score += Math.min(18, interactionScore * 2);

      // Long connection
      if (
        account.firstConnectedAt &&
        now - account.firstConnectedAt > 365 * 24 * 60 * 60
      ) {
        score += 8;
      }

      // Fast follow-back
      if (
        account.followBackTimeMs &&
        account.followBackTimeMs < 7 * 24 * 60 * 60 * 1000
      ) {
        score += 5;
      }

      const isSilentMutual =
        account.isMutual &&
        account.dmMessageCount === 0 &&
        account.groupMessageCount < 3 &&
        interactionScore === 0;

      if (isSilentMutual) {
        score = Math.min(score, SILENT_MUTUAL_CAP);
      }

      if (!hasMeaningfulInteraction(account) && !account.isMutual) {
        score = Math.min(score, 15);
      }

      score = Math.round(Math.max(0, Math.min(100, score)));

      const relationshipLabel = isSilentMutual
        ? ("Silent mutual" as const)
        : account.relationshipLabel;

      return {
        username: account.username,
        displayName: account.displayName,
        realOnesScore: score,
        dmMessageCount: account.dmMessageCount,
        groupMessageCount: account.groupMessageCount,
        isMutual: account.isMutual,
        relationshipLabel,
        lastDmAt: account.lastDmAt,
        followBackTimeMs: account.followBackTimeMs,
        interactionScore,
        isSilentMutual,
        sourceBreakdown: account.sourceBreakdown,
      };
    })
    .filter((a) => a.realOnesScore > 0)
    .sort((a, b) => b.realOnesScore - a.realOnesScore);
}

export function computeSilentMutuals(
  realOnes: RealOnesAccount[]
): RealOnesAccount[] {
  return realOnes
    .filter((a) => a.isSilentMutual)
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .slice(0, 25);
}

export const REAL_ONES_LEADERBOARDS = {
  topRealOnes: (accounts: RealOnesAccount[]) =>
    [...accounts]
      .filter((a) => !a.isSilentMutual && a.realOnesScore > SILENT_MUTUAL_CAP)
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
        displayName: a.displayName,
        realOnesScore: 0,
        dmMessageCount: a.dmMessageCount,
        groupMessageCount: a.groupMessageCount,
        isMutual: a.isMutual,
        relationshipLabel: a.relationshipLabel,
        lastDmAt: a.lastDmAt,
        interactionScore: 0,
        isSilentMutual: false,
      })),
};
