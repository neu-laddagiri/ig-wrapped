import type { UnifiedAccount } from "@/types/insights";
import type { AccountLeaderboard, AccountLeaderboardEntry } from "@/types/insights";
import type { RealOnesAccount } from "@/types/insights";
import { findUnifiedAccount } from "@/lib/relationshipEngine";
import type { DirectDmIndex } from "@/lib/insights/directDmIndex";

function toEntry(
  account: UnifiedAccount | { username: string; displayName: string },
  score: number,
  partial: Partial<AccountLeaderboardEntry> = {},
  sourceBreakdown?: AccountLeaderboardEntry["sourceBreakdown"]
): AccountLeaderboardEntry {
  return {
    username: account.username,
    displayName: account.displayName,
    score,
    dmCount: partial.dmCount ?? 0,
    groupDmCount: partial.groupDmCount ?? 0,
    likeCount: partial.likeCount ?? 0,
    commentCount: partial.commentCount ?? 0,
    saveCount: partial.saveCount ?? 0,
    storyCount: partial.storyCount ?? 0,
    sourceBreakdown,
  };
}

function attributableCount(
  account: UnifiedAccount,
  field: "likes" | "comments" | "stories"
): number {
  if (field === "likes") {
    return account.likesAttribution === "attributed" ? account.likedCount : 0;
  }
  if (field === "comments") {
    return account.commentsAttribution === "attributed"
      ? account.commentedCount
      : 0;
  }
  return account.storiesAttribution === "attributed"
    ? account.storyInteractionCount
    : 0;
}

export function buildAccountLeaderboards(
  accounts: UnifiedAccount[],
  interactionMap: Map<string, { likes: number; comments: number; stories: number; saves: number }>,
  realOnes: RealOnesAccount[] = [],
  directDmIndex?: DirectDmIndex
): AccountLeaderboard[] {
  const boards: AccountLeaderboard[] = [];
  const networkAccounts = accounts.filter((a) => !a.isUnknownAccount);

  const withInteractions = networkAccounts.map((a) => {
    const directDm = a.dmMessageCount;
    const groupSent = a.groupMessageCount ?? 0;
    const likes = attributableCount(a, "likes");
    const comments = attributableCount(a, "comments");
    const stories = attributableCount(a, "stories");
    const score =
      directDm * 5 +
      groupSent * 0.25 +
      likes * 1.5 +
      comments * 1.5 +
      stories +
      (a.isMutual ? 3 : 0);
    return toEntry(
      a,
      score,
      {
        dmCount: directDm,
        groupDmCount: groupSent,
        likeCount: likes,
        commentCount: comments,
        storyCount: stories,
        saveCount: 0,
      },
      a.sourceBreakdown
    );
  });

  boards.push({
    id: "top-accounts",
    title: "Top Accounts in Your IG World",
    entries: [...withInteractions]
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 25),
    sourceNote:
      "Direct 1:1 DMs dominate (×5). Group sends are weak (×0.25). Attributable likes/comments only.",
    emptyReason:
      withInteractions.length === 0
        ? "Instagram did not include enough account-level data for this category."
        : undefined,
  });

  boards.push({
    id: "top-dm",
    title: "Most DM'd Accounts",
    entries: (directDmIndex?.records.length
      ? directDmIndex.records.slice(0, 20).map((r) => {
          const acc = findUnifiedAccount(accounts, r.accountKey);
          return toEntry(
            acc ?? {
              username: r.username ?? r.accountKey,
              displayName: r.displayName,
            },
            r.totalMessages,
            { dmCount: r.totalMessages },
            acc?.sourceBreakdown
          );
        })
      : [...accounts]
          .filter((a) => a.dmMessageCount > 0)
          .sort((a, b) => b.dmMessageCount - a.dmMessageCount)
          .slice(0, 20)
          .map((a) =>
            toEntry(
              a,
              a.dmMessageCount,
              { dmCount: a.dmMessageCount },
              a.sourceBreakdown
            )
          )),
    sourceNote:
      "Same normalized 1:1 DM threads as the DMs tab. Group chats excluded.",
    emptyReason: "No 1-on-1 DM threads found.",
  });

  boards.push({
    id: "top-group",
    title: "Top Group Chat Participants",
    entries: [...accounts]
      .filter((a) => (a.groupMessageCount ?? 0) > 0)
      .sort((a, b) => (b.groupMessageCount ?? 0) - (a.groupMessageCount ?? 0))
      .slice(0, 20)
      .map((a) =>
        toEntry(
          a,
          a.groupMessageCount ?? 0,
          { groupDmCount: a.groupMessageCount },
          a.sourceBreakdown
        )
      ),
    sourceNote: "Messages sent inside group chats only — not membership.",
    emptyReason: "No group chat senders matched.",
  });

  const realOnesEntries =
    realOnes.length > 0
      ? realOnes.slice(0, 20).map((r) => {
          const acc = findUnifiedAccount(accounts, r.username);
          return toEntry(
            acc ?? { username: r.username, displayName: r.displayName },
            r.realOnesScore,
            { dmCount: r.dmMessageCount },
            acc?.sourceBreakdown
          );
        })
      : [...accounts]
          .filter((a) => a.dmMessageCount > 0 && !a.isUnknownAccount)
          .sort((a, b) => b.dmMessageCount - a.dmMessageCount)
          .slice(0, 20)
          .map((a) =>
            toEntry(a, a.dmMessageCount, { dmCount: a.dmMessageCount }, a.sourceBreakdown)
          );

  boards.push({
    id: "real-ones",
    title: "Real Ones",
    entries: realOnesEntries,
    sourceNote:
      "Direct 1:1 DM volume, balance, recency, and mutual bonus — same source as DMs tab.",
    emptyReason: "No direct 1-on-1 DM relationships found in this export.",
  });

  boards.push({
    id: "top-liked",
    title: "Most Liked Accounts",
    entries: [...accounts]
      .filter((a) => a.likesAttribution === "attributed" && a.likedCount > 0)
      .sort((a, b) => b.likedCount - a.likedCount)
      .slice(0, 20)
      .map((a) =>
        toEntry(a, a.likedCount, { likeCount: a.likedCount }, a.sourceBreakdown)
      ),
    sourceNote:
      "Only confidently matched likes from activity export JSON.",
    emptyReason:
      "Instagram did not include enough account-level data for this category.",
  });

  return boards;
}

export { extractInteractionAccounts } from "@/lib/interactionExportParser";

export const LEADERBOARD_SOURCE_LABELS: Record<string, string> = {
  "top-accounts": "Direct DMs dominate; group sends are weak",
  "top-dm": "Normalized 1:1 DM threads (DMs tab source)",
  "top-group": "Group chat sender counts only",
  "real-ones": "Weighted direct DM relationship score",
  "top-liked": "Likes from activity export",
};
