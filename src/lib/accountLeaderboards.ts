import { normalizeUsername } from "@/lib/formatters";
import { isValidAccountName, sanitizeAccountName } from "@/lib/accountNameFilter";
import type { UnifiedAccount } from "@/types/insights";
import type { AccountLeaderboard, AccountLeaderboardEntry } from "@/types/insights";

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

export function buildAccountLeaderboards(
  accounts: UnifiedAccount[],
  interactionMap: Map<string, { likes: number; comments: number; stories: number; saves: number }>
): AccountLeaderboard[] {
  const boards: AccountLeaderboard[] = [];
  const networkAccounts = accounts.filter((a) => !a.isUnknownAccount);

  const withInteractions = networkAccounts.map((a) => {
    const i = interactionMap.get(a.username);
    const directDm = a.dmMessageCount;
    const groupSent = a.groupMessageCount ?? 0;
    const score =
      directDm * 3 +
      groupSent * 0.75 +
      (i?.likes ?? a.likedCount) * 2 +
      (i?.comments ?? a.commentedCount) * 2 +
      (i?.stories ?? a.storyInteractionCount) +
      (i?.saves ?? 0) * 2 +
      (a.isMutual ? 5 : 0);
    return toEntry(
      a,
      score,
      {
        dmCount: directDm,
        groupDmCount: groupSent,
        likeCount: i?.likes ?? a.likedCount,
        commentCount: i?.comments ?? a.commentedCount,
        storyCount: i?.stories ?? a.storyInteractionCount,
        saveCount: i?.saves ?? 0,
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
      "Weighted: direct 1-on-1 DMs (strong), group messages sent (low), likes/comments/stories, small mutual bonus.",
    emptyReason:
      withInteractions.length === 0
        ? "Instagram did not include enough account-level data for this category."
        : undefined,
  });

  boards.push({
    id: "top-dm",
    title: "Most DM'd Accounts",
    entries: [...accounts]
      .filter((a) => a.dmMessageCount > 0)
      .sort((a, b) => b.dmMessageCount - a.dmMessageCount)
      .slice(0, 20)
      .map((a) =>
        toEntry(a, a.dmMessageCount, { dmCount: a.dmMessageCount }, a.sourceBreakdown)
      ),
    sourceNote: "True 1-on-1 DM threads only. One attribution per thread to the other participant.",
    emptyReason: "No 1-on-1 DM threads found.",
  });

  boards.push({
    id: "top-group",
    title: "Top Group Chat Participants",
    entries: [...networkAccounts]
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
    sourceNote: "Messages actually sent in group chats (sender_name). Membership alone does not count.",
    emptyReason: "No group chat senders matched network accounts.",
  });

  boards.push({
    id: "real-ones",
    title: "Real Ones",
    entries: [...accounts]
      .filter(
        (a) =>
          !a.isUnknownAccount &&
          a.dmMessageCount > 0 &&
          (a.sourceBreakdown?.directDmMessages ?? a.dmMessageCount) > 0
      )
      .map((a) => {
        const score =
          a.dmMessageCount * 3 +
          (a.groupMessageCount ?? 0) * 0.5 +
          (a.likedCount + a.commentedCount) * 2 +
          (a.isMutual ? 8 : 0);
        return toEntry(a, score, { dmCount: a.dmMessageCount }, a.sourceBreakdown);
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 20),
    sourceNote: "Accounts with direct 1-on-1 DM history plus interaction signals.",
  });

  boards.push({
    id: "silent-mutuals",
    title: "Silent Mutuals",
    entries: networkAccounts
      .filter(
        (a) =>
          a.isMutual &&
          a.dmMessageCount === 0 &&
          (a.groupMessageCount ?? 0) < 3 &&
          a.likedCount + a.commentedCount + a.storyInteractionCount === 0
      )
      .map((a) => toEntry(a, 0, {}, a.sourceBreakdown))
      .slice(0, 25),
    sourceNote: "Mutual follows with little or no DM or interaction data.",
  });

  boards.push({
    id: "top-liked",
    title: "Most Liked Accounts",
    entries: [...interactionMap.entries()]
      .filter(([, v]) => v.likes > 0)
      .sort((a, b) => b[1].likes - a[1].likes)
      .slice(0, 20)
      .map(([username, v]) => {
        const acc = accounts.find((a) => a.username === username);
        return toEntry(
          acc ?? { username, displayName: username },
          v.likes,
          { likeCount: v.likes },
          acc?.sourceBreakdown
        );
      }),
    sourceNote: "Parsed from liked_posts / liked_comments titles in export JSON.",
    emptyReason:
      "Instagram did not include enough account-level data for this category.",
  });

  return boards;
}

export function extractInteractionAccounts(
  files: Map<string, string>
): Map<string, { likes: number; comments: number; stories: number; saves: number }> {
  const map = new Map<string, { likes: number; comments: number; stories: number; saves: number }>();

  const rules: { fragment: string; field: keyof { likes: number; comments: number; stories: number; saves: number } }[] = [
    { fragment: "liked_posts", field: "likes" },
    { fragment: "liked_comments", field: "likes" },
    { fragment: "post_comments", field: "comments" },
    { fragment: "stories_viewed", field: "stories" },
    { fragment: "story_likes", field: "stories" },
    { fragment: "saved_posts", field: "saves" },
  ];

  function add(username: string, field: "likes" | "comments" | "stories" | "saves") {
    const key = sanitizeAccountName(username);
    if (!key) return;
    const existing = map.get(key) ?? { likes: 0, comments: 0, stories: 0, saves: 0 };
    existing[field]++;
    map.set(key, existing);
  }

  for (const rule of rules) {
    for (const [path, content] of files) {
      const lower = path.toLowerCase().replace(/\\/g, "/");
      if (!lower.includes(rule.fragment)) continue;
      try {
        const data = JSON.parse(content);
        extractTitles(data, (title) => add(title, rule.field));
      } catch {
        continue;
      }
    }
  }

  return map;
}

function extractTitles(data: unknown, onTitle: (title: string) => void): void {
  if (Array.isArray(data)) {
    data.forEach((item) => extractTitles(item, onTitle));
    return;
  }
  if (typeof data !== "object" || data === null) return;
  const obj = data as Record<string, unknown>;
  if (typeof obj.title === "string" && obj.title.trim()) {
    const title = obj.title.trim();
    if (isValidAccountName(title) && !title.includes("http")) {
      onTitle(title);
    }
    return;
  }
  if (Array.isArray(obj.string_list_data)) {
    for (const entry of obj.string_list_data) {
      if (typeof entry === "object" && entry !== null) {
        const v = (entry as Record<string, unknown>).value;
        if (typeof v === "string" && v.trim() && !v.includes("http")) {
          if (isValidAccountName(v)) onTitle(v.trim());
        }
      }
    }
  }
  for (const val of Object.values(obj)) {
    if (Array.isArray(val) || (typeof val === "object" && val !== null)) {
      extractTitles(val, onTitle);
    }
  }
}

export const LEADERBOARD_SOURCE_LABELS: Record<string, string> = {
  "top-accounts": "Direct DMs + group messages sent + likes/comments/stories",
  "top-dm": "Direct 1-on-1 DMs only (one other participant per thread)",
  "top-group": "Group messages by sender_name",
  "real-ones": "Direct DMs + interactions (excludes silent mutuals)",
  "silent-mutuals": "Mutual follow only, no meaningful interaction",
  "top-liked": "Likes from activity JSON titles",
};
