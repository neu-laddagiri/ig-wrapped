import { isInstagramPlaceholderName } from "@/lib/accountNameFilter";
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
  hideNames = true,
  insights?: Pick<
    InsightsBundle,
    "accounts" | "cleanup" | "realOnes" | "dmAwards" | "adsInsights" | "exportCompleteness"
  >
): ShareCardData[] {
  const network = parsed.network;
  const messages = parsed.messages;
  const ads = parsed.ads;
  const wrapped = parsed.wrapped;
  const era = parsed.mostActiveEra;
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

  const biggestChatName = topDirect
    ? formatChatLabel(topDirect.displayName, topDirect.isUnknownAccount)
    : topThread
      ? formatChatLabel(topThread.threadName)
      : "your top chat";

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
      era?.mostActiveMonthLabel ? `Peak era: ${era.mostActiveMonthLabel}` : "",
      `Export quality: ${completeness.score}/100`,
    ].filter(Boolean),
    sensitiveLines: topDirect
      ? [`Biggest 1-on-1: ${biggestChatName}`]
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
      sensitiveLines: topThread
        ? [`Biggest 1-on-1: ${biggestChatName} (${topThread.messageCount.toLocaleString()} msgs)`]
        : undefined,
    });
  }

  if (ads) {
    cards.push({
      id: "ads",
      title: "Ads & Privacy Wrapped",
      hideNames,
      lines: [
        `Advertisers: ${ads.advertisersCount}`,
        `Ad categories: ${ads.adCategoriesCount}`,
        contentDiet
          ? `Ad resistance: ${contentDiet.adClickResistance}%`
          : "",
        insights?.adsInsights
          ? `Privacy score: ${insights.adsInsights.privacyCreepScore}/100`
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
