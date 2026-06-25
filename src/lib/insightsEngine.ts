import type { ParsedExportData } from "@/types/instagram";
import type {
  ContentDietResult,
  DataExplorerMeta,
  InsightsBundle,
  PersonalityResult,
} from "@/types/insights";
import { buildUnifiedAccounts } from "@/lib/relationshipEngine";
import { computeCleanupScores } from "@/lib/cleanupScoring";
import { computeRealOnesScores, computeSilentMutuals } from "@/lib/realOnesScoring";
import { buildDmStatsAndDebug } from "@/lib/dmParticipantResolution";
import { computeDmRelationshipInsights } from "@/lib/dmRelationshipAnalytics";
import { computeGroupChatInsights } from "@/lib/groupChatWrapped";
import { buildErasTimeline } from "@/lib/activityTimeline";
import { computeContentDiet } from "@/lib/contentDiet";
import {
  buildAccountLeaderboards,
  extractInteractionAccounts,
  LEADERBOARD_SOURCE_LABELS,
} from "@/lib/accountLeaderboards";
import { computeAdsPrivacyInsights } from "@/lib/adsPrivacyInsights";
import { computeSecurityAudit } from "@/lib/securityAudit";
import { parseSearchHistory } from "@/lib/searchHistoryParser";
import { computeExportCompleteness } from "@/lib/exportCompleteness";
import { buildShareCards } from "@/lib/shareCard";
import { parseConnectedApps } from "@/lib/parsers/appsParser";
import type { LinkedInHelperEntry } from "@/types/instagram";

export const INSIGHTS_BUNDLE_VERSION = 3;

function computePersonality(
  parsed: ParsedExportData,
  contentDiet: ContentDietResult | null
): PersonalityResult | null {
  const { network, messages, wrapped, ads } = parsed;
  if (!network && !messages && !wrapped) return null;

  const dmVol = messages?.totalMessages ?? 0;
  const stories = wrapped?.storiesViewed ?? 0;
  const likes = wrapped?.likedPosts ?? 0;
  const mutualRatio =
    network && network.totalFollowing > 0
      ? network.mutuals.length / network.totalFollowing
      : 0;
  const passive = contentDiet?.passiveRatio ?? 0.5;

  let title = "The Social Strategist";
  const reasons: string[] = [];

  if (dmVol > 5000) {
    title = "The DM Main Character";
    reasons.push(`${dmVol.toLocaleString()} messages — DMs dominate your IG life.`);
  } else if (stories > likes * 1.5) {
    title = "The Story Lurker";
    reasons.push("Story views outpace active likes.");
  } else if (likes > 500) {
    title = "The Generous Liker";
    reasons.push(`${likes.toLocaleString()} liked posts in your export.`);
  } else if (passive > 0.75) {
    title = "The Ad-Resistant Scroller";
    reasons.push("Mostly passive consumption with low click rates.");
  } else if (messages && messages.groupChatCount > messages.oneOnOneCount) {
    title = "The Group Chat Chaos Agent";
    reasons.push("Group chats outweigh 1:1 threads.");
  } else if (mutualRatio > 0.6) {
    title = "The Real Ones Collector";
    reasons.push(`Strong mutual ratio (${Math.round(mutualRatio * 100)}%).`);
  } else if (network && network.dontFollowMeBack.length > network.mutuals.length) {
    title = "The Cleanup Candidate";
    reasons.push("Following list has room to tighten up.");
  }

  if (reasons.length < 3) {
    if (wrapped?.savedPosts && wrapped.savedPosts > 30)
      reasons.push(`${wrapped.savedPosts} saved posts — curator energy.`);
    if (ads && ads.adsClicked === 0 && ads.adsViewed > 50)
      reasons.push("Rarely clicks ads.");
    if (messages?.totalThreads)
      reasons.push(`${messages.totalThreads} DM threads tracked.`);
  }

  return {
    title,
    description: contentDiet?.caption ?? "Your Instagram personality from export data.",
    reasons: reasons.slice(0, 3),
    stats: [
      { label: "DM messages", value: dmVol.toLocaleString() },
      { label: "Mutual ratio", value: `${Math.round(mutualRatio * 100)}%` },
      {
        label: "Story views",
        value: stories.toLocaleString(),
      },
    ],
  };
}

function buildDataExplorer(parsed: ParsedExportData): DataExplorerMeta {
  const categoryMap: Record<string, string> = {
    connections: "Network",
    messages: "DMs",
    "your_instagram_activity": "Activity",
    ads_information: "Ads",
    security_and_login_information: "Security",
    apps_and_websites: "Connected apps",
    logged_information: "Logged info",
    personal_information: "Personal info",
    media: "Media",
    preferences: "Preferences",
  };

  const files = parsed.filePaths.map((path) => {
    const lower = path.toLowerCase().replace(/\\/g, "/");
    const folder = lower.split("/")[0] ?? "root";
    const category =
      Object.entries(categoryMap).find(([k]) => lower.includes(k))?.[1] ??
      "Other";
    const contributed =
      lower.includes("followers") ||
      lower.includes("following") ||
      lower.includes("message_") ||
      lower.includes("liked_") ||
      lower.includes("ads_") ||
      lower.includes("login_activity") ||
      lower.includes("stories_");
    return {
      path,
      category,
      folder,
      contributed,
      feature: contributed ? category : undefined,
    };
  });

  return {
    files: files.slice(0, 500),
    jsonCount: parsed.jsonFiles,
    mediaCount: parsed.mediaFiles,
    totalCount: parsed.totalFiles,
  };
}

export function computeInsightsBundle(
  parsed: ParsedExportData,
  files?: Map<string, string>,
  linkedinProgress: LinkedInHelperEntry[] = []
): InsightsBundle {
  const interactionMap = files
    ? extractInteractionAccounts(files)
    : new Map();

  const accounts = buildUnifiedAccounts({
    network: parsed.network,
    messages: parsed.messages,
    linkedinProgress,
    interactionCounts: interactionMap,
  });

  const cleanup = computeCleanupScores(accounts);
  const realOnes = computeRealOnesScores(accounts);
  const silentMutuals = computeSilentMutuals(realOnes);
  const { threadDebug } = buildDmStatsAndDebug({
    messages: parsed.messages,
    network: parsed.network,
  });
  const { insights: dmRelationshipInsights, awards: dmAwards } =
    computeDmRelationshipInsights(parsed.messages);
  const groupChats = computeGroupChatInsights(parsed.messages);
  const eras = buildErasTimeline(parsed, parsed.mostActiveEra);
  const contentDiet = computeContentDiet({
    wrapped: parsed.wrapped,
    messages: parsed.messages,
    ads: parsed.ads,
  });
  const leaderboards = buildAccountLeaderboards(accounts, interactionMap);
  const leaderboardSources = { ...LEADERBOARD_SOURCE_LABELS };
  const adsInsights = computeAdsPrivacyInsights(parsed.ads);
  const connectedApps = files ? parseConnectedApps(files) : [];
  const securityAudit = computeSecurityAudit(parsed.security, connectedApps);
  const searchWrapped = files ? parseSearchHistory(files) : null;
  const personality = computePersonality(parsed, contentDiet);
  const exportCompleteness = computeExportCompleteness(parsed.coverage, {
    hasSearch: Boolean(searchWrapped),
    hasApps: connectedApps.length > 0,
  });

  const partialInsights = {
    accounts,
    cleanup,
    realOnes,
    dmAwards,
    adsInsights,
    exportCompleteness,
  };
  const shareCards = buildShareCards(
    parsed,
    personality,
    contentDiet,
    false,
    partialInsights
  );
  const dataExplorer = {
    ...buildDataExplorer(parsed),
    leaderboardSources,
    dmThreadDebug: threadDebug.slice(0, 200),
  };

  return {
    version: INSIGHTS_BUNDLE_VERSION,
    accounts,
    cleanup,
    realOnes,
    silentMutuals,
    dmRelationshipInsights,
    dmAwards,
    groupChats,
    eras,
    contentDiet,
    leaderboards,
    adsInsights,
    securityAudit,
    searchWrapped,
    personality,
    shareCards,
    exportCompleteness,
    dataExplorer,
  };
}

export function resolveInsightsBundle(
  parsed: ParsedExportData,
  linkedinProgress: LinkedInHelperEntry[] = []
): InsightsBundle {
  const existing = parsed.insights;
  if (
    existing &&
    (existing.version ?? 0) >= INSIGHTS_BUNDLE_VERSION
  ) {
    return {
      ...existing,
      silentMutuals: existing.silentMutuals ?? [],
    };
  }
  return computeInsightsBundle(parsed, undefined, linkedinProgress);
}
