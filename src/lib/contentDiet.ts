import type {
  AdsPrivacyData,
  DmAnalytics,
  WrappedInsights,
} from "@/types/instagram";
import type { ContentDietResult } from "@/types/insights";
import { adClickStats } from "@/lib/adsPrivacyInsights";

export function computeContentDiet(params: {
  wrapped: WrappedInsights | null;
  messages: DmAnalytics | null;
  ads: AdsPrivacyData | null;
}): ContentDietResult | null {
  const { wrapped, messages, ads } = params;
  if (!wrapped && !messages) return null;

  const w = wrapped ?? {
    likedPosts: 0,
    likedComments: 0,
    postComments: 0,
    savedPosts: 0,
    storiesViewed: 0,
    storyLikes: 0,
    pollInteractions: 0,
    emojiSliderInteractions: 0,
    quizzes: 0,
    videosWatched: 0,
    postsViewed: 0,
  };

  const passive =
    w.storiesViewed +
    w.videosWatched +
    w.postsViewed +
    (ads?.adsViewed ?? 0);
  const active =
    w.likedPosts +
    w.likedComments +
    w.postComments +
    w.savedPosts +
    w.storyLikes +
    w.pollInteractions +
    w.emojiSliderInteractions +
    w.quizzes +
    (messages?.totalMessages ?? 0);

  const total = passive + active;
  if (total === 0) return null;

  const passiveRatio = passive / total;
  const likes = w.likedPosts + w.likedComments;
  const likingVsLurkingRatio = likes / Math.max(passive, 1);
  const saveRate = w.savedPosts / Math.max(w.likedPosts, 1);
  const commentRate = w.postComments / Math.max(w.likedPosts, 1);
  const storyViewerScore = w.storiesViewed;
  const doomscrollScore = Math.min(
    100,
    Math.round(((w.videosWatched + w.postsViewed) / Math.max(total, 1)) * 100)
  );
  // null when there is no ad-view history; the shared type still wants a number.
  const resistance = adClickStats(ads).resistance;
  const adClickResistance = resistance ?? 100;

  let personality = "Engagement Machine";
  if (messages && messages.totalMessages > likes * 2) personality = "DM-First User";
  else if (w.storiesViewed > likes * 2) personality = "Story Watcher";
  else if (w.videosWatched > likes * 3) personality = "Reels Addict";
  else if (passiveRatio > 0.7) personality = "Silent Viewer";
  else if (likes > w.savedPosts * 5) personality = "Generous Liker";
  else if (w.postComments < 5 && likes > 50) personality = "Comment Ghost";
  else if (
    resistance !== null &&
    resistance > 90 &&
    (ads?.adsViewed ?? 0) >= 50
  )
    personality = "Ad-Resistant Scroller";

  const caption =
    personality === "DM-First User"
      ? wrapped
        ? "You talk more than you scroll."
        : "Based on DMs only — this export has no likes, stories or views to compare."
      : personality === "Story Watcher"
        ? "Stories get more of your attention than likes."
        : personality === "Reels Addict"
          ? "Video consumption dominates your feed time."
          : "Your engagement mix is uniquely yours.";

  return {
    passiveCount: passive,
    activeCount: active,
    passiveRatio,
    likingVsLurkingRatio,
    saveRate,
    commentRate,
    storyViewerScore,
    doomscrollScore,
    adClickResistance,
    personality,
    caption,
    metrics: [
      { label: "Passive actions", value: passive.toLocaleString() },
      { label: "Active actions", value: active.toLocaleString() },
      { label: "Passive ratio", value: `${Math.round(passiveRatio * 100)}%` },
      { label: "Doomscroll score", value: `${doomscrollScore}/100` },
      {
        label: "Ad resistance",
        value: resistance === null ? "—" : `${resistance}%`,
      },
    ],
  };
}
