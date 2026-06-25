import type { CanonicalAccount } from "@/lib/canonicalAccounts";
import { canonicalRankReason } from "@/lib/canonicalAccounts";
import type { UnifiedAccount } from "@/types/insights";

export interface LinkedInInteractionScore {
  score: number;
  reason: string;
  directDmCount: number;
  lastDmAt?: number;
  isSilentMutual: boolean;
  isUnknown: boolean;
}

/** Score is for tie-breaking only — primary sort uses DM count + recency. Never negative. */
export function computeLinkedInInteractionScore(
  canonical: CanonicalAccount
): LinkedInInteractionScore {
  const directDmCount = canonical.directDmCount;
  const isUnknown = canonical.isUnknownAccount;
  const lastDmAt = canonical.lastDmAt;

  let score = directDmCount;

  if (lastDmAt) {
    const ageDays = (Date.now() / 1000 - lastDmAt) / 86400;
    if (ageDays <= 30) score += 1000;
    else if (ageDays <= 90) score += 500;
  }

  if (canonical.isMutual) score += 50;
  else {
    if (canonical.followsMe) score += 10;
    if (canonical.iFollowThem) score += 10;
  }

  if (canonical.likesAttribution === "attributed") {
    score += Math.min(canonical.likedCount, 20);
  }
  if (canonical.commentsAttribution === "attributed") {
    score += Math.min(canonical.commentedCount, 20);
  }

  const isSilentMutual =
    canonical.isMutual &&
    directDmCount === 0 &&
    canonical.groupMessageCount < 2;

  return {
    score,
    reason: canonicalRankReason(canonical),
    directDmCount,
    lastDmAt,
    isSilentMutual,
    isUnknown,
  };
}

export function computeNetworkOnlyInteractionScore(
  category?: string
): LinkedInInteractionScore {
  const isMutual = category === "mutual";
  return {
    score: isMutual ? 5 : 0,
    reason: isMutual
      ? "Network only · mutual · no direct DMs"
      : "Network only · no direct DMs",
    directDmCount: 0,
    isSilentMutual: isMutual,
    isUnknown: false,
  };
}

export function isSilentMutualAccount(account: UnifiedAccount): boolean {
  return (
    account.isMutual &&
    account.dmMessageCount === 0 &&
    (account.groupMessageCount ?? 0) < 2
  );
}

export function isSilentMutualCanonical(c: CanonicalAccount): boolean {
  return c.isMutual && c.directDmCount === 0 && c.groupMessageCount < 2;
}
