import type { ParsedExportData } from "@/types/instagram";
import type {
  ContentDietResult,
  DataExplorerMeta,
  InsightsBundle,
  PersonalityResult,
} from "@/types/insights";
import { buildUnifiedAccounts, buildSearchMap } from "@/lib/relationshipEngine";
import { computeCleanupScores } from "@/lib/cleanupScoring";
import { computeRealOnesScores, computeSilentMutuals } from "@/lib/realOnesScoring";
import { buildDmStatsAndDebug } from "@/lib/dmParticipantResolution";
import { computeDmRelationshipInsights } from "@/lib/dmRelationshipAnalytics";
import { computeGroupChatInsights } from "@/lib/groupChatWrapped";
import { buildErasTimeline } from "@/lib/activityTimeline";
import { computeContentDiet } from "@/lib/contentDiet";
import {
  buildAccountLeaderboards,
  LEADERBOARD_SOURCE_LABELS,
} from "@/lib/accountLeaderboards";
import { extractInteractionAccounts } from "@/lib/interactionExportParser";
import { validateDmLeaderboardParity } from "@/lib/canonicalAccount";
import {
  buildDmAccountIndex,
  overlayDmStatsOnAccounts,
} from "@/lib/dmAccountIndex";
import type { CanonicalAccount } from "@/lib/canonicalAccounts";
import {
  buildCanonicalAccountIndex,
  compareCanonicalForLinkedIn,
  syncUnifiedDmFromCanonical,
} from "@/lib/canonicalAccounts";
import { buildDmReceiptIndex } from "@/lib/accountReceipt";
import { computeAdsPrivacyInsights } from "@/lib/adsPrivacyInsights";
import { computeSecurityAudit } from "@/lib/securityAudit";
import { parseSearchHistory } from "@/lib/searchHistoryParser";
import { computeExportCompleteness } from "@/lib/exportCompleteness";
import { buildShareCards } from "@/lib/shareCard";
import { parseConnectedApps } from "@/lib/parsers/appsParser";
import type { LinkedInHelperEntry } from "@/types/instagram";
import { enrichInsightsBundle } from "@/lib/advancedInsights";
import { buildCoreAnalytics } from "@/lib/insights/coreAnalytics";
import {
  getCanonicalAccountKey,
  getDisplayLabel,
  getSecondaryLabel,
  isLikelyInstagramUsername,
  validateIdentityIndex,
} from "@/lib/accountIdentity";
import { computeLinkedInInteractionScore } from "@/lib/linkedinInteractionScore";

export const INSIGHTS_BUNDLE_VERSION = 17;

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
  const interactionResult = files
    ? extractInteractionAccounts(files)
    : { map: new Map(), meta: undefined };
  const interactionMap = interactionResult.map;
  const interactionMeta = interactionResult.meta;

  const searchWrapped = files
    ? parseSearchHistory(files)
    : (parsed.insights?.searchWrapped ?? null);

  const searchByUsername = buildSearchMap(searchWrapped);

  const coreAnalytics = buildCoreAnalytics({
    messages: parsed.messages,
    network: parsed.network,
    files,
  });

  const { threadDebug, graph } = buildDmStatsAndDebug({
    messages: parsed.messages,
    network: parsed.network,
    interactionCounts: interactionMap,
    interactionMeta,
    searchByUsername,
    hasSearchExport: Boolean(searchWrapped?.topAccounts?.length),
    coreAnalytics,
    files,
  });

  let accounts = buildUnifiedAccounts({
    network: parsed.network,
    messages: parsed.messages,
    linkedinProgress,
    interactionCounts: interactionMap,
    interactionMeta,
    searchWrapped,
    graph,
    coreAnalytics,
    files,
  });

  const dmAccountIndex = buildDmAccountIndex(coreAnalytics);
  accounts = overlayDmStatsOnAccounts(accounts, dmAccountIndex);

  const canonicalIndex = buildCanonicalAccountIndex(coreAnalytics, accounts);
  accounts = syncUnifiedDmFromCanonical(accounts, canonicalIndex);
  const canonicalAccounts: CanonicalAccount[] = canonicalIndex.accounts;
  const dmReceiptByUsername = buildDmReceiptIndex(accounts);

  validateIdentityIndex(
    accounts.map((a) => ({
      canonicalKey: getCanonicalAccountKey({ username: a.username }),
      username: a.username,
      displayName: getDisplayLabel(a),
      secondaryLabel: getSecondaryLabel(a),
      isUnknownDeleted: Boolean(a.isUnknownAccount),
    }))
  );

  const cleanup = computeCleanupScores(accounts);
  const realOnes = computeRealOnesScores(accounts);
  const silentMutuals = computeSilentMutuals(accounts);
  const { insights: dmRelationshipInsights, awards: dmAwards } =
    computeDmRelationshipInsights(parsed.messages);
  const groupChats = computeGroupChatInsights(parsed.messages);
  const contentDiet = computeContentDiet({
    wrapped: parsed.wrapped,
    messages: parsed.messages,
    ads: parsed.ads,
  });
  const leaderboards = buildAccountLeaderboards(
    accounts,
    interactionMap,
    realOnes,
    coreAnalytics
  );
  const leaderboardSources = { ...LEADERBOARD_SOURCE_LABELS };
  const adsInsights = computeAdsPrivacyInsights(parsed.ads);
  const connectedApps = files ? parseConnectedApps(files) : [];
  const securityAudit = computeSecurityAudit(parsed.security, connectedApps);
  const personality = computePersonality(parsed, contentDiet);
  const exportCompleteness = computeExportCompleteness(parsed.coverage, {
    hasSearch: Boolean(searchWrapped),
    hasApps: connectedApps.length > 0,
  });

  const eras = buildErasTimeline(
    parsed,
    parsed.mostActiveEra,
    files,
    searchWrapped
  );

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
  const topLinkedInMostInteracted = canonicalAccounts
    .filter((c) => isLikelyInstagramUsername(c.username) || c.directDmCount > 0)
    .map((canonical) => {
      const interaction = computeLinkedInInteractionScore(canonical);
      return {
        name: canonical.displayLabel,
        username: canonical.username,
        score: interaction.score,
        breakdown: interaction.reason,
      };
    })
    .sort((a, b) => {
      const ca = canonicalIndex.byUsername.get(a.username);
      const cb = canonicalIndex.byUsername.get(b.username);
      if (ca && cb) {
        return compareCanonicalForLinkedIn(ca, cb);
      }
      return b.score - a.score;
    })
    .slice(0, 20);

  const topRealOnesDebug = realOnes.slice(0, 20).map((r) => ({
    name: r.displayName,
    username: r.username,
    score: r.realOnesScore,
    breakdown: r.scoreBreakdown ?? r.rankReason ?? "",
  }));

  const topDmBoard = leaderboards.find((b) => b.id === "top-dm");
  const parity = validateDmLeaderboardParity(
    coreAnalytics,
    (topDmBoard?.entries ?? []).map((e) => ({
      displayName: e.displayName,
      dmCount: e.dmCount,
    }))
  );

  const dataExplorer = {
    ...buildDataExplorer(parsed),
    leaderboardSources,
    dmThreadDebug: threadDebug.slice(0, 200),
    identityResolution: graph.debug,
    coreAnalytics: {
      ...coreAnalytics.debug,
      topLinkedInMostInteracted,
      topRealOnes: topRealOnesDebug,
      validation: {
        dmLeaderboardParityOk: parity.ok,
        dmLeaderboardParityNotes: parity.notes,
        blockedIncluded: parsed.network?.blockedMeta?.includedInExport ?? false,
        restrictedIncluded:
          parsed.network?.restrictedMeta?.includedInExport ?? false,
        ownerIdentityConfidence: coreAnalytics.ownerIdentity.confidence,
        ownerIdentityUsernames: coreAnalytics.ownerIdentity.usernames,
        ownerIdentityDisplayNames: coreAnalytics.ownerIdentity.displayNames,
        ownerIdentitySources: coreAnalytics.ownerIdentity.sources,
        interactionExportMeta: interactionMeta,
      },
    },
  };

  return enrichInsightsBundle(
    {
      version: INSIGHTS_BUNDLE_VERSION,
      accounts,
      canonicalAccounts,
      dmReceiptByUsername,
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
    },
    parsed
  );
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
    return enrichInsightsBundle(
      {
        ...existing,
        silentMutuals: existing.silentMutuals ?? [],
      },
      parsed
    );
  }
  return enrichInsightsBundle(
    computeInsightsBundle(parsed, undefined, linkedinProgress),
    parsed
  );
}
