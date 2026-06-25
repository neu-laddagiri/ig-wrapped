import type { CanonicalAccount } from "@/lib/canonicalAccounts";
import { directDmRankReason } from "@/lib/insights/directDmIndex";
import type { DirectDmRecord } from "@/lib/insights/directDmIndex";

export interface LinkedInInteractionScore {
  score: number;
  reason: string;
  directDmCount: number;
  lastDmAt?: number;
  isSilentMutual: boolean;
  isUnknown: boolean;
}

export function computeLinkedInInteractionScore(
  canonical: CanonicalAccount,
  dmRecord?: DirectDmRecord
): LinkedInInteractionScore {
  const directDmCount = dmRecord?.totalMessages ?? canonical.directDmCount;
  const lastDmAt = dmRecord?.lastDmAt ?? canonical.lastDmAt;
  const isUnknown = canonical.isUnknownAccount;

  const isSilentMutual =
    canonical.isMutual && directDmCount === 0 && canonical.groupMessageCount < 2;

  const reason = directDmRankReason(
    dmRecord ??
      (directDmCount > 0
        ? {
            threadId: canonical.directDmThreadId ?? canonical.key,
            accountKey: canonical.key,
            displayName: canonical.displayName,
            username: canonical.username,
            aliases: [],
            totalMessages: directDmCount,
            lastDmAt,
            source: "dm-thread",
            confidence: "high",
          }
        : undefined),
    canonical.isMutual
  );

  return {
    score: directDmCount,
    reason,
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
    score: 0,
    reason: isMutual
      ? "Network only · mutual · no direct DMs"
      : "Network only · no direct DMs",
    directDmCount: 0,
    isSilentMutual: isMutual,
    isUnknown: false,
  };
}

export function computeDirectDmInteractionScore(
  dmRecord: DirectDmRecord,
  network?: { isMutual?: boolean }
): LinkedInInteractionScore {
  return {
    score: dmRecord.totalMessages,
    reason: directDmRankReason(dmRecord, network?.isMutual ?? false),
    directDmCount: dmRecord.totalMessages,
    lastDmAt: dmRecord.lastDmAt,
    isSilentMutual: false,
    isUnknown: false,
  };
}
