import type { ParsedExportData } from "@/types/instagram";
import type { InsightsBundle } from "@/types/insights";
import type { UnifiedAccount } from "@/types/insights";
import type { AccountFlag } from "@/types/insights";

export function computeAccountFlags(
  account: UnifiedAccount,
  insights?: InsightsBundle | null
): { green: AccountFlag[]; red: AccountFlag[] } {
  const green: AccountFlag[] = [];
  const red: AccountFlag[] = [];

  if (account.isMutual && account.dmMessageCount > 30) {
    green.push({
      id: "mutual-dm",
      label: "Mutual + active DMs",
      tone: "green",
    });
  }
  if (account.followsMe && !account.iFollowThem) {
    green.push({
      id: "follows-you",
      label: "Follows you — you don't follow back",
      tone: "green",
    });
  }
  if (account.dmMessageCount > 0 && account.isMutual) {
    const real = insights?.realOnes.find((r) => r.username === account.username);
    if (real && real.realOnesScore > 55) {
      green.push({
        id: "real-one",
        label: "High Real Ones score",
        tone: "green",
      });
    }
  }
  if (account.likedCount > 10 || account.commentedCount > 3) {
    green.push({
      id: "recent-interaction",
      label: "Recent likes/comments in export",
      tone: "green",
    });
  }
  if (
    account.linkedInStatus === "connected" ||
    account.linkedInStatus === "request-sent" ||
    account.linkedInStatus === "found"
  ) {
    green.push({
      id: "linkedin-positive",
      label: "Positive LinkedIn helper status",
      tone: "green",
    });
  }
  if (account.followedMeAt && account.followedMeAt < Date.now() - 86400000 * 365 * 2) {
    green.push({
      id: "long-follower",
      label: "Long-time follower",
      tone: "green",
    });
  }

  if (account.iFollowThem && !account.followsMe) {
    red.push({
      id: "no-follow-back",
      label: "You follow them — no follow back",
      tone: "red",
    });
  }
  if (account.iFollowThem && account.dmMessageCount === 0 && !account.isMutual) {
    red.push({
      id: "no-dm",
      label: "No direct DMs",
      tone: "red",
    });
  }
  if (
    account.iFollowThem &&
    account.likedCount === 0 &&
    account.commentedCount === 0 &&
    account.dmMessageCount === 0
  ) {
    red.push({
      id: "no-interaction",
      label: "No meaningful interactions",
      tone: "red",
    });
  }
  if (account.relationshipLabel === "Pending request") {
    red.push({
      id: "pending",
      label: "Pending request for a while",
      tone: "red",
    });
  }
  if (account.isUnknownAccount || account.nameConfidence === "low") {
    red.push({
      id: "unknown",
      label: "Unknown / low-confidence account",
      tone: "red",
    });
  }
  if (
    account.iFollowedAt &&
    account.iFollowedAt < Date.now() - 86400000 * 365 * 3 &&
    account.dmMessageCount === 0 &&
    account.likedCount === 0
  ) {
    red.push({
      id: "dead-follow",
      label: "Old follow with no recent activity",
      tone: "red",
    });
  }

  return { green, red };
}

export interface ExportComparison {
  label: string;
  before: number | string;
  after: number | string;
  delta?: number;
  positive?: boolean;
}

export function compareParsedExports(
  before: ParsedExportData,
  after: ParsedExportData,
  beforeLabel = "Earlier",
  afterLabel = "Current"
): {
  summary: ExportComparison[];
  newFollowers: string[];
  lostFollowers: string[];
  newFollowing: string[];
  unfollowed: string[];
  newMutuals: string[];
  lostMutuals: string[];
} {
  void beforeLabel;
  void afterLabel;
  const bNet = before.network;
  const aNet = after.network;
  const bFollowers = new Set(bNet?.followers.map((f) => f.username) ?? []);
  const aFollowers = new Set(aNet?.followers.map((f) => f.username) ?? []);
  const bFollowing = new Set(bNet?.following.map((f) => f.username) ?? []);
  const aFollowing = new Set(aNet?.following.map((f) => f.username) ?? []);
  const bMutuals = new Set(bNet?.mutuals.map((f) => f.username) ?? []);
  const aMutuals = new Set(aNet?.mutuals.map((f) => f.username) ?? []);

  const newFollowers = [...aFollowers].filter((u) => !bFollowers.has(u));
  const lostFollowers = [...bFollowers].filter((u) => !aFollowers.has(u));
  const newFollowing = [...aFollowing].filter((u) => !bFollowing.has(u));
  const unfollowed = [...bFollowing].filter((u) => !aFollowing.has(u));
  const newMutuals = [...aMutuals].filter((u) => !bMutuals.has(u));
  const lostMutuals = [...bMutuals].filter((u) => !aMutuals.has(u));

  const bRatio = bNet?.followBackRatio ?? 0;
  const aRatio = aNet?.followBackRatio ?? 0;
  const bMsgs = before.messages?.totalMessages ?? 0;
  const aMsgs = after.messages?.totalMessages ?? 0;
  const bThreads = before.messages?.totalThreads ?? 0;
  const aThreads = after.messages?.totalThreads ?? 0;

  const summary: ExportComparison[] = [
    {
      label: "Followers",
      before: bNet?.totalFollowers ?? 0,
      after: aNet?.totalFollowers ?? 0,
      delta: (aNet?.totalFollowers ?? 0) - (bNet?.totalFollowers ?? 0),
    },
    {
      label: "Following",
      before: bNet?.totalFollowing ?? 0,
      after: aNet?.totalFollowing ?? 0,
      delta: (aNet?.totalFollowing ?? 0) - (bNet?.totalFollowing ?? 0),
    },
    {
      label: "Mutuals",
      before: bNet?.mutuals.length ?? 0,
      after: aNet?.mutuals.length ?? 0,
      delta: (aNet?.mutuals.length ?? 0) - (bNet?.mutuals.length ?? 0),
    },
    {
      label: "Follow-back ratio",
      before: `${Math.round(bRatio * 100)}%`,
      after: `${Math.round(aRatio * 100)}%`,
      delta: Math.round((aRatio - bRatio) * 100),
      positive: aRatio >= bRatio,
    },
    {
      label: "DM messages",
      before: bMsgs,
      after: aMsgs,
      delta: aMsgs - bMsgs,
    },
    {
      label: "DM threads",
      before: bThreads,
      after: aThreads,
      delta: aThreads - bThreads,
    },
    {
      label: "Ads viewed",
      before: before.ads?.adsViewed ?? 0,
      after: after.ads?.adsViewed ?? 0,
      delta: (after.ads?.adsViewed ?? 0) - (before.ads?.adsViewed ?? 0),
    },
  ];

  return {
    summary,
    newFollowers,
    lostFollowers,
    newFollowing,
    unfollowed,
    newMutuals,
    lostMutuals,
  };
}
