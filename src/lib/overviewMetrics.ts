import type { ParsedExportData } from "@/types/instagram";
import { resolveInsightsBundle } from "@/lib/insightsEngine";
import { resolveMostActiveEra } from "@/lib/mostActiveEra";
import type { LinkedInHelperEntry } from "@/types/instagram";

export function buildOverviewMetrics(
  parsed: ParsedExportData,
  linkedinProgress: LinkedInHelperEntry[] = []
): Record<string, string | number | null> {
  const insights = resolveInsightsBundle(parsed, linkedinProgress);
  const network = parsed.network;
  const wrapped = parsed.wrapped;
  const messages = parsed.messages;
  const ads = parsed.ads;
  const era = resolveMostActiveEra(parsed);

  const avgCleanup =
    insights.cleanup.length > 0
      ? Math.round(
          insights.cleanup.reduce((s, c) => s + c.cleanupPriorityScore, 0) /
            insights.cleanup.length
        )
      : null;

  const avgRealOnes =
    insights.realOnes.length > 0
      ? Math.round(
          insights.realOnes.reduce((s, r) => s + r.realOnesScore, 0) /
            insights.realOnes.length
        )
      : null;

  return {
    followers: network?.totalFollowers ?? null,
    following: network?.totalFollowing ?? null,
    mutuals: network?.mutuals.length ?? null,
    followBackRatioPct: network
      ? Math.round(network.followBackRatio * 100)
      : null,
    likedPosts: wrapped?.likedPosts ?? null,
    comments: wrapped?.postComments ?? null,
    savedPosts: wrapped?.savedPosts ?? null,
    storyViews: wrapped?.storiesViewed ?? null,
    dmThreads: messages?.totalThreads ?? null,
    dmMessages: messages?.totalMessages ?? null,
    oneOnOneThreads: messages?.oneOnOneCount ?? null,
    groupChats: messages?.groupChatCount ?? null,
    mostActiveEra: era?.mostActiveMonthLabel ?? null,
    contentPersonality: insights.contentDiet?.personality ?? null,
    passiveRatioPct: insights.contentDiet
      ? Math.round(insights.contentDiet.passiveRatio * 100)
      : null,
    adsViewed: ads?.adsViewed ?? null,
    adsClicked: ads?.adsClicked ?? null,
    adResistance: insights.contentDiet?.adClickResistance ?? null,
    privacyCreepScore: insights.adsInsights?.privacyCreepScore ?? null,
    avgCleanupScore: avgCleanup,
    avgRealOnesScore: avgRealOnes,
    securityHealthScore: insights.securityAudit?.healthScore ?? null,
    securityWorthReviewing:
      parsed.security?.suspiciousLoginAnalysis?.worthReviewingCount ?? null,
    searchTotal: insights.searchWrapped?.totalSearches ?? null,
    instagramPersonality: insights.personality?.title ?? null,
    exportQuality: insights.exportCompleteness.score,
  };
}
