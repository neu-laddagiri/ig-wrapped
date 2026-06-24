import type {
  AdsPrivacyData,
  DmAnalytics,
  DmThreadAnalytics,
  MostActiveEraData,
  NetworkStats,
  WrappedInsights,
} from "@/types/instagram";
import { formatMonthLabel, formatPercent } from "@/lib/formatters";
import { normalizeDmThreads } from "@/lib/dmThreads";

export interface FunStatCard {
  id: string;
  title: string;
  value: string;
  description: string;
  available: boolean;
}

function balanceScore(thread: DmThreadAnalytics): number {
  const counts = Object.values(thread.messagesBySender ?? {});
  if (counts.length < 2) return 0;
  const total = thread.messageCount;
  const top = Math.max(...counts);
  const second = counts.sort((a, b) => b - a)[1] ?? 0;
  return 1 - Math.abs(top - second) / Math.max(total, 1);
}

function oneSidedScore(thread: DmThreadAnalytics): number {
  const counts = Object.values(thread.messagesBySender ?? {});
  if (counts.length === 0) return 0;
  return Math.max(...counts) / Math.max(thread.messageCount, 1);
}

export function computeFunStats(params: {
  network: NetworkStats | null;
  wrapped: WrappedInsights | null;
  messages: DmAnalytics | null;
  ads: AdsPrivacyData | null;
  mostActiveEra?: MostActiveEraData | null;
}): FunStatCard[] {
  const { network, wrapped, messages, ads, mostActiveEra } = params;
  const threads = normalizeDmThreads(messages);

  const biggestYapper = threads.length
    ? [...threads].sort((a, b) => b.messageCount - a.messageCount)[0]
    : null;

  const mostBalanced = threads.length
    ? [...threads].sort((a, b) => balanceScore(b) - balanceScore(a))[0]
    : null;

  const mostOneSided = threads.length
    ? [...threads].sort((a, b) => oneSidedScore(b) - oneSidedScore(a))[0]
    : null;

  const reelsDealer = threads.length
    ? [...threads].sort(
        (a, b) =>
          b.instagramReelLinks +
          b.instagramPostLinks +
          b.estimatedInstagramLinks -
          (a.instagramReelLinks +
            a.instagramPostLinks +
            a.estimatedInstagramLinks)
      )[0]
    : null;

  const oldestActive = threads
    .filter((t) => t.firstMessageTimestamp)
    .sort(
      (a, b) =>
        (a.firstMessageTimestamp ?? 0) - (b.firstMessageTimestamp ?? 0)
    )[0];

  const mostRecent = threads
    .filter((t) => t.lastMessageTimestamp)
    .sort(
      (a, b) =>
        (b.lastMessageTimestamp ?? 0) - (a.lastMessageTimestamp ?? 0)
    )[0];

  const dmPeakMonth = messages?.messagesByMonth.length
    ? [...messages.messagesByMonth].sort((a, b) => b.count - a.count)[0]
    : null;

  const eraPeak = mostActiveEra;

  const totalInteractions = wrapped
    ? wrapped.likedPosts +
      wrapped.likedComments +
      wrapped.postComments +
      wrapped.savedPosts +
      wrapped.storiesViewed +
      wrapped.storyLikes
    : 0;

  const mutualRatio =
    network && network.totalFollowing > 0
      ? network.mutuals.length / network.totalFollowing
      : null;

  const cleanupScore = network
    ? Math.max(
        0,
        100 -
          Math.round(
            (network.dontFollowMeBack.length /
              Math.max(network.totalFollowing, 1)) *
              100
          )
      )
    : null;

  const parasocialScore =
    wrapped && totalInteractions > 0
      ? Math.min(
          99,
          Math.round((wrapped.storiesViewed / totalInteractions) * 100)
        )
      : null;

  const storyViewerScore = wrapped?.storiesViewed
    ? wrapped.storiesViewed
    : null;

  const dmToLikeRatio =
    messages && wrapped && wrapped.likedPosts > 0
      ? (messages.totalMessages / wrapped.likedPosts).toFixed(1)
      : null;

  const adsRatio =
    ads && ads.adsViewed > 0
      ? formatPercent(ads.adsClicked / ads.adsViewed)
      : null;

  let personality = "Quiet Scroller";
  if (wrapped) {
    if (wrapped.storiesViewed > wrapped.likedPosts * 1.5)
      personality = "Story Stalker";
    else if (wrapped.likedPosts > wrapped.savedPosts * 2)
      personality = "Generous Liker";
    else if (wrapped.savedPosts > 50) personality = "Curator";
    else if (messages && messages.totalMessages > 5000)
      personality = "DM Power User";
  }

  const hiddenName = "••••••••";

  return [
    {
      id: "biggest-yapper",
      title: "Biggest yapper",
      value: biggestYapper
        ? `${hiddenName} (${biggestYapper.messageCount.toLocaleString()} msgs)`
        : "—",
      description: "Thread with the most messages overall.",
      available: Boolean(biggestYapper),
    },
    {
      id: "most-balanced",
      title: "Most balanced chat",
      value: mostBalanced ? hiddenName : "—",
      description: "Conversation with the most even message split.",
      available: Boolean(mostBalanced),
    },
    {
      id: "most-one-sided",
      title: "Most one-sided chat",
      value: mostOneSided ? hiddenName : "—",
      description: "Thread where one person sends most messages.",
      available: Boolean(mostOneSided),
    },
    {
      id: "reels-dealer",
      title: "Reels dealer",
      value: reelsDealer ? hiddenName : "—",
      description: "Thread with the most shared Instagram links.",
      available: Boolean(reelsDealer),
    },
    {
      id: "oldest-dm",
      title: "Oldest active DM",
      value: oldestActive ? hiddenName : "—",
      description: "Longest-running thread by first message date.",
      available: Boolean(oldestActive),
    },
    {
      id: "recent-dm",
      title: "Most recent active DM",
      value: mostRecent ? hiddenName : "—",
      description: "Thread with the latest message activity.",
      available: Boolean(mostRecent),
    },
    {
      id: "active-era",
      title: "Most active era",
      value: eraPeak?.mostActiveMonthLabel ?? "—",
      description: eraPeak
        ? `${eraPeak.mostActiveMonthCount.toLocaleString()} tracked actions${eraPeak.topActivityCaption ? ` · ${eraPeak.topActivityCaption}` : ""}`
        : "Peak month across all timestamped Instagram activity.",
      available: Boolean(eraPeak),
    },
    {
      id: "active-month",
      title: "Most active DM month",
      value: dmPeakMonth ? formatMonthLabel(dmPeakMonth.month) : "—",
      description: dmPeakMonth
        ? `${dmPeakMonth.count.toLocaleString()} messages that month`
        : "Peak DM month across all threads.",
      available: Boolean(dmPeakMonth),
    },
    {
      id: "follow-back",
      title: "Follow-back ratio",
      value: network ? formatPercent(network.followBackRatio) : "—",
      description: "Share of following who follow you back.",
      available: Boolean(network),
    },
    {
      id: "cleanup",
      title: "Network cleanup score",
      value: cleanupScore !== null ? `${cleanupScore}/100` : "—",
      description: "Higher = tighter follow ratio.",
      available: cleanupScore !== null,
    },
    {
      id: "parasocial",
      title: "Parasocial score",
      value: parasocialScore !== null ? `${parasocialScore}%` : "—",
      description: "Passive story viewing vs active engagement.",
      available: parasocialScore !== null,
    },
    {
      id: "mutual-ratio",
      title: "Mutual ratio",
      value: mutualRatio !== null ? formatPercent(mutualRatio) : "—",
      description: "Mutuals as a share of following.",
      available: mutualRatio !== null,
    },
    {
      id: "interactions",
      title: "Total interactions",
      value: totalInteractions > 0 ? totalInteractions.toLocaleString() : "—",
      description: "Likes, comments, saves, and story activity combined.",
      available: totalInteractions > 0,
    },
    {
      id: "ads-ratio",
      title: "Ads clicked vs viewed",
      value: adsRatio ?? "—",
      description: "How often you click ads you see.",
      available: Boolean(adsRatio),
    },
    {
      id: "story-score",
      title: "Story viewer score",
      value:
        storyViewerScore !== null ? storyViewerScore.toLocaleString() : "—",
      description: "Total stories viewed from your export.",
      available: storyViewerScore !== null,
    },
    {
      id: "liked-posts",
      title: "Liked posts total",
      value: wrapped ? wrapped.likedPosts.toLocaleString() : "—",
      description: "Posts you liked according to your export.",
      available: Boolean(wrapped?.likedPosts),
    },
    {
      id: "dm-like-ratio",
      title: "DM-to-like ratio",
      value: dmToLikeRatio ? `${dmToLikeRatio}:1` : "—",
      description: "Messages sent per post liked.",
      available: Boolean(dmToLikeRatio),
    },
    {
      id: "personality",
      title: "Your IG personality",
      value: personality,
      description: "A playful label from your activity mix.",
      available: Boolean(wrapped || messages),
    },
  ];
}

export function resolveFunStatValue(
  card: FunStatCard,
  showThreadNames: boolean,
  threads: DmThreadAnalytics[]
): string {
  if (!showThreadNames) return card.value;
  const nameCards = [
    "biggest-yapper",
    "most-balanced",
    "most-one-sided",
    "reels-dealer",
    "oldest-dm",
    "recent-dm",
  ];
  if (!nameCards.includes(card.id)) return card.value;

  const map: Record<string, DmThreadAnalytics | null | undefined> = {
    "biggest-yapper": [...threads].sort(
      (a, b) => b.messageCount - a.messageCount
    )[0],
    "most-balanced": [...threads].sort(
      (a, b) => balanceScore(b) - balanceScore(a)
    )[0],
    "most-one-sided": [...threads].sort(
      (a, b) => oneSidedScore(b) - oneSidedScore(a)
    )[0],
    "reels-dealer": [...threads].sort(
      (a, b) =>
        b.instagramReelLinks +
        b.instagramPostLinks -
        (a.instagramReelLinks + a.instagramPostLinks)
    )[0],
    "oldest-dm": threads
      .filter((t) => t.firstMessageTimestamp)
      .sort(
        (a, b) =>
          (a.firstMessageTimestamp ?? 0) - (b.firstMessageTimestamp ?? 0)
      )[0],
    "recent-dm": threads
      .filter((t) => t.lastMessageTimestamp)
      .sort(
        (a, b) =>
          (b.lastMessageTimestamp ?? 0) - (a.lastMessageTimestamp ?? 0)
      )[0],
  };

  const thread = map[card.id];
  if (!thread) return card.value;
  const label = thread.isGroupChat
    ? `Group · ${thread.participantCount} people`
    : thread.threadName;
  if (card.id === "biggest-yapper") {
    return `${label} (${thread.messageCount.toLocaleString()} msgs)`;
  }
  return label;
}
