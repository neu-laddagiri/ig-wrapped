import type { UnifiedAccount } from "@/types/insights";
import type { CleanupAccount, CleanupLabel } from "@/types/insights";

const IMPORTANT_LINKEDIN = new Set([
  "found",
  "request-sent",
  "connected",
]);

type KeepReason = "dm" | "interaction" | "linkedin" | "other";

function cleanupLabel(score: number, keep: KeepReason | null): CleanupLabel {
  if (keep === "dm") return "Keep — mutual/DM active";
  if (keep === "linkedin") return "Keep — manually marked important";
  if (keep) return "Keep — you actually interact";
  if (score >= 70) return "High cleanup priority";
  if (score >= 45) return "Medium cleanup priority";
  return "Low cleanup priority";
}

export function computeCleanupScores(
  accounts: UnifiedAccount[]
): CleanupAccount[] {
  const now = Math.floor(Date.now() / 1000);
  const yearAgo = now - 365 * 24 * 60 * 60;

  return accounts
    .filter((a) => a.iFollowThem)
    .map((account) => {
      let score = 0;
      let keep = false;

      if (!account.followsMe) score += 25;
      if (!account.hasDmThread) score += 20;
      if (account.dmMessageCount === 0) score += 15;
      if (
        account.likedCount === 0 &&
        account.commentedCount === 0 &&
        account.storyInteractionCount === 0
      ) {
        score += 15;
      }
      if (account.iFollowedAt && account.iFollowedAt < yearAgo) score += 10;
      if (!account.isMutual) score += 10;
      if (
        account.linkedInStatus &&
        IMPORTANT_LINKEDIN.has(account.linkedInStatus)
      ) {
        keep = true;
        score = Math.min(score, 20);
      }
      if (account.isMutual && account.dmMessageCount > 20) {
        keep = true;
        score = 0;
      }
      if (account.dmMessageCount > 100) {
        keep = true;
        score = 0;
      }
      if (
        account.likedCount + account.commentedCount + account.storyInteractionCount >
        10
      ) {
        keep = true;
        score = Math.min(score, 25);
      }
      if (account.relationshipLabel === "Blocked/restricted" || account.relationshipLabel === "Pending request") {
        keep = true;
        score = 0;
      }

      score = Math.max(0, Math.min(100, score));

      const keepReason: KeepReason | null = !keep
        ? null
        : (account.isMutual && account.dmMessageCount > 20) ||
            account.dmMessageCount > 100
          ? "dm"
          : account.likedCount + account.commentedCount + account.storyInteractionCount > 10
            ? "interaction"
            : account.linkedInStatus && IMPORTANT_LINKEDIN.has(account.linkedInStatus)
              ? "linkedin"
              : "other";
      const label = cleanupLabel(score, keepReason);

      let recommendedAction = "No action needed.";
      if (label === "High cleanup priority")
        recommendedAction = "Strong candidate to unfollow — little interaction.";
      else if (label === "Medium cleanup priority")
        recommendedAction = "Review when cleaning up your following list.";
      else if (label.startsWith("Keep"))
        recommendedAction = "Keep — meaningful connection or interaction.";

      return {
        username: account.username,
        displayName: account.displayName,
        cleanupPriorityScore: score,
        label,
        recommendedAction,
        iFollowThem: account.iFollowThem,
        followsMe: account.followsMe,
        dmMessageCount: account.dmMessageCount,
        isMutual: account.isMutual,
        linkedInStatus: account.linkedInStatus,
      };
    })
    .sort((a, b) => b.cleanupPriorityScore - a.cleanupPriorityScore);
}
