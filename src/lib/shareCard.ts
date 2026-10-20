import { isInstagramPlaceholderName } from "@/lib/accountNameFilter";
import { adClickStats } from "@/lib/adsPrivacyInsights";
import type { ParsedExportData } from "@/types/instagram";
import type {
  ContentDietResult,
  InsightsBundle,
  PersonalityResult,
  ShareCardData,
} from "@/types/insights";

export function buildShareCards(
  parsed: ParsedExportData,
  personality: PersonalityResult | null,
  contentDiet: ContentDietResult | null,
  hideNames = false,
  insights?: Pick<
    InsightsBundle,
    "accounts" | "cleanup" | "realOnes" | "dmAwards" | "adsInsights" | "exportCompleteness"
  > &
    Partial<Pick<InsightsBundle, "eras">>
): ShareCardData[] {
  const network = parsed.network;
  const messages = parsed.messages;
  const ads = parsed.ads;
  const wrapped = parsed.wrapped;
  // Same peak as the Eras tab when the timeline is available.
  const peakEraLabel =
    insights?.eras?.peakMonth?.label ?? parsed.mostActiveEra?.mostActiveMonthLabel;
  const completeness = insights?.exportCompleteness ?? {
    score: 0,
    detectedCount: 0,
    totalCategories: 0,
    missing: [],
    recommendations: [],
    categoryStatus: [],
  };

  const cards: ShareCardData[] = [];

  const directRanked = [...(insights?.accounts ?? [])]
    .filter((a) => a.dmMessageCount > 0)
    .sort((a, b) => b.dmMessageCount - a.dmMessageCount);

  let topDirect = directRanked[0];
  if (topDirect?.isUnknownAccount && directRanked.length > 1) {
    const named = directRanked.find((a) => !a.isUnknownAccount);
    if (named && named.dmMessageCount >= topDirect.dmMessageCount * 0.85) {
      topDirect = named;
    }
  }

  const topThread = [...(messages?.threads ?? [])]
    .filter((t) => !t.isGroupChat)
    .sort((a, b) => b.messageCount - a.messageCount)[0];

  const formatChatLabel = (name: string, isUnknown?: boolean) => {
    if (isUnknown || isInstagramPlaceholderName(name)) {
      return "Unknown / deleted account";
    }
    return name;
  };

  // Name and count always come from the same account (or the same thread).
  const biggestChat = topDirect
    ? {
        name: formatChatLabel(topDirect.displayName, topDirect.isUnknownAccount),
        count: topDirect.dmMessageCount,
      }
    : topThread
      ? { name: formatChatLabel(topThread.threadName), count: topThread.messageCount }
      : null;

  cards.push({
    id: "overall",
    title: "IG Wrapped",
    hideNames,
    lines: [
      `Followers: ${network?.totalFollowers.toLocaleString() ?? "—"}`,
      `Following: ${network?.totalFollowing.toLocaleString() ?? "—"}`,
      `Mutuals: ${network?.mutuals.length.toLocaleString() ?? "—"}`,
      `Follow-back: ${network ? Math.round(network.followBackRatio * 100) : "—"}%`,
      `Liked posts: ${wrapped?.likedPosts.toLocaleString() ?? "—"}`,
      `Stories viewed: ${wrapped?.storiesViewed.toLocaleString() ?? "—"}`,
      `DM threads: ${messages?.totalThreads.toLocaleString() ?? "—"}`,
      `DM messages: ${messages?.totalMessages.toLocaleString() ?? "—"}`,
      `Ads viewed: ${ads?.adsViewed.toLocaleString() ?? "—"}`,
      personality ? `Personality: ${personality.title}` : "",
      peakEraLabel ? `Peak era: ${peakEraLabel}` : "",
      `Export quality: ${completeness.score}/100`,
    ].filter(Boolean),
    sensitiveLines: biggestChat
      ? [`Biggest 1-on-1: ${biggestChat.name}`]
      : undefined,
  });

  cards.push({
    id: "public-safe",
    title: "Public Safe Summary",
    hideNames: true,
    lines: [
      `Followers: ${network?.totalFollowers.toLocaleString() ?? "—"}`,
      `Following: ${network?.totalFollowing.toLocaleString() ?? "—"}`,
      `Mutuals: ${network?.mutuals.length.toLocaleString() ?? "—"}`,
      `Liked posts: ${wrapped?.likedPosts.toLocaleString() ?? "—"}`,
      `DM messages: ${messages?.totalMessages.toLocaleString() ?? "—"}`,
      personality ? `Personality: ${personality.title}` : "",
    ].filter(Boolean),
  });

  if (network) {
    cards.push({
      id: "network",
      title: "Network Wrapped",
      hideNames,
      lines: [
        `Follow-back ratio: ${Math.round(network.followBackRatio * 100)}%`,
        `Mutuals: ${network.mutuals.length.toLocaleString()}`,
        `Don't follow back: ${network.dontFollowMeBack.length.toLocaleString()}`,
        `Cleanup candidates: ${insights?.cleanup.filter((c) => c.cleanupPriorityScore >= 60).length ?? "—"}`,
        `Real Ones avg: ${insights?.realOnes.length ? Math.round(insights.realOnes.reduce((s, r) => s + r.realOnesScore, 0) / insights.realOnes.length) : "—"}`,
      ],
    });
  }

  if (messages) {
    cards.push({
      id: "dm",
      title: "DM Wrapped",
      hideNames,
      lines: [
        `Threads: ${messages.totalThreads.toLocaleString()}`,
        `Messages: ${messages.totalMessages.toLocaleString()}`,
        insights?.dmAwards[0]
          ? `Top award: ${insights.dmAwards[0].title}`
          : "",
      ].filter(Boolean),
      sensitiveLines: biggestChat
        ? [
            `Biggest 1-on-1: ${biggestChat.name} (${biggestChat.count.toLocaleString()} msg${biggestChat.count === 1 ? "" : "s"})`,
          ]
        : undefined,
    });
  }

  if (ads) {
    const resistance = adClickStats(ads).resistance;
    cards.push({
      id: "ads",
      title: "Ads & Privacy Wrapped",
      hideNames,
      lines: [
        `Advertisers: ${ads.advertisersCount}`,
        `Ad categories: ${ads.adCategoriesCount}`,
        resistance !== null ? `Ad resistance: ${resistance}%` : "",
        insights?.adsInsights
          ? `Privacy creep score: ${insights.adsInsights.privacyCreepScore}/100`
          : "",
      ].filter(Boolean),
    });
  }

  return cards;
}

export function renderShareCardLines(
  card: ShareCardData,
  hideNames: boolean
): string[] {
  const lines = [...card.lines];
  if (card.sensitiveLines?.length) {
    if (hideNames || card.hideNames) {
      lines.push("Biggest chat: Hidden for privacy");
    } else {
      lines.push(...card.sensitiveLines);
    }
  }
  return lines;
}
