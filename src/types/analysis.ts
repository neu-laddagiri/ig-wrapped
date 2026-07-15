import type { DashboardTabId } from "@/components/DashboardTabs";
import type {
  LinkedInHelperEntry,
  ParsedExportData,
  DmAnalytics,
  DmThreadAnalytics,
} from "@/types/instagram";
import type { DmAiSummariesMap } from "@/types/dmAiSummary";
import type { OverviewAiSummaryResult } from "@/types/overviewAiSummary";
import { normalizeDmThreads } from "@/lib/dmThreads";
import { buildAiSummarySampleForCloud } from "@/lib/dmMessageSampling";

export const ANALYSIS_SNAPSHOT_VERSION = 7;

export interface AnalysisSnapshot {
  version: typeof ANALYSIS_SNAPSHOT_VERSION;
  exportName: string;
  fileFingerprint: string;
  analysisMode: string;
  instagramUsername: string | null;
  activeTab: DashboardTabId;
  dmShowThreadNames: boolean;
  dmShowFirstMessagePreview: boolean;
  includeAiMessageSamples?: boolean;
  expandedGroupThreads: string[];
  dmAiSummaries?: DmAiSummariesMap;
  overviewAiSummary?: OverviewAiSummaryResult | null;
  parsedAt: string;
  parsed: ParsedExportDataForSave;
}

/** Parsed data stored in cloud — omits large file path lists */
export type ParsedExportDataForSave = Omit<ParsedExportData, "filePaths"> & {
  filePaths?: never;
};

export interface SavedAnalysisRow {
  id: string;
  user_id: string;
  title: string | null;
  export_name: string | null;
  instagram_username: string | null;
  analysis_mode: string | null;
  file_fingerprint: string | null;
  full_analysis_json: AnalysisSnapshot;
  linkedin_progress_json: LinkedInHelperEntry[];
  created_at: string;
  updated_at: string;
}

export interface SavedAnalysisSummary {
  id: string;
  title: string;
  exportName: string;
  instagramUsername: string | null;
  analysisMode: string;
  createdAt: string;
  updatedAt: string;
  followerCount: number | null;
  followingCount: number | null;
  mutualCount: number | null;
}

export interface CloudSaveResult {
  success: boolean;
  error?: string;
  id?: string;
}

export interface CreateSnapshotInput {
  parsedData: ParsedExportData;
  fileName: string;
  fileFingerprint: string;
  linkedinProgress: LinkedInHelperEntry[];
  activeTab: DashboardTabId;
  dmShowThreadNames: boolean;
  dmShowFirstMessagePreview: boolean;
  includeAiMessageSamples?: boolean;
  expandedGroupThreads: string[];
  dmAiSummaries?: DmAiSummariesMap;
  overviewAiSummary?: OverviewAiSummaryResult | null;
  analysisMode?: string;
}

function enrichThreadForCloudSave(
  thread: DmThreadAnalytics,
  includePreviews: boolean,
  showThreadNames: boolean,
  includeAiMessageSamples: boolean
): DmThreadAnalytics {
  const result: DmThreadAnalytics = { ...thread };
  delete result.textMessages;
  delete result.sourcePath;
  delete result.threadPath;

  if (!includePreviews) {
    delete result.firstMessagePreview;
  }

  if (!includeAiMessageSamples) {
    delete result.aiSummarySample;
  } else if (thread.textMessages?.length) {
    const built = buildAiSummarySampleForCloud(thread.textMessages, {
      mostActiveMonth: thread.mostActiveMonth,
      isGroup: thread.isGroupChat,
      showThreadNames,
    });
    if (built) result.aiSummarySample = built;
  }

  if (!showThreadNames) {
    const names = new Set<string>([
      ...(thread.participants ?? []),
      ...Object.keys(thread.messagesBySender ?? {}),
      ...Object.keys(thread.reelsLinksBySender ?? {}),
      ...Object.keys(thread.postLinksBySender ?? {}),
    ]);
    if (thread.firstMessageSender) names.add(thread.firstMessageSender);
    if (thread.lastMessageSender) names.add(thread.lastMessageSender);
    const labels = new Map(
      [...names].filter(Boolean).map((name, index) => [name, `Person ${index + 1}`])
    );
    const anonymizeName = (name: string) => labels.get(name) ?? "Person";
    const anonymizeCounts = (counts: Record<string, number>) =>
      Object.fromEntries(
        Object.entries(counts).map(([name, count]) => [anonymizeName(name), count])
      );

    result.threadName = thread.isGroupChat ? "Group chat" : "Direct message";
    result.title = result.threadName;
    result.participants = (thread.participants ?? []).map(anonymizeName);
    result.messagesBySender = anonymizeCounts(thread.messagesBySender ?? {});
    result.reelsLinksBySender = anonymizeCounts(thread.reelsLinksBySender ?? {});
    result.postLinksBySender = anonymizeCounts(thread.postLinksBySender ?? {});
    result.firstMessageSender = thread.firstMessageSender
      ? anonymizeName(thread.firstMessageSender)
      : undefined;
    result.lastMessageSender = thread.lastMessageSender
      ? anonymizeName(thread.lastMessageSender)
      : undefined;
  }

  return result;
}

function sanitizeMessages(
  messages: DmAnalytics | null,
  includePreviews: boolean,
  showThreadNames: boolean,
  includeAiMessageSamples: boolean
): DmAnalytics | null {
  if (!messages) return null;
  const sanitize = (t: DmThreadAnalytics) =>
    enrichThreadForCloudSave(
      t,
      includePreviews,
      showThreadNames,
      includeAiMessageSamples
    );
  const threads = normalizeDmThreads(messages).map(sanitize);
  const topThreads = (
    Array.isArray(messages.topThreads) ? messages.topThreads : threads
  )
    .slice()
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, 25)
    .map(sanitize);
  return {
    ...messages,
    threads,
    topThreads,
  };
}

const HIDDEN_IDENTITY_LABEL = "Hidden for privacy";

function buildAnonymousLabels(
  names: Array<string | undefined>
): Map<string, string> {
  const labels = new Map<string, string>();
  for (const name of names) {
    if (!name || labels.has(name)) continue;
    labels.set(name, `Person ${labels.size + 1}`);
  }
  return labels;
}

function anonymizeNamedCounts(
  counts: Record<string, number>,
  labels: Map<string, string>
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(counts).map(([name, count]) => [
      labels.get(name) ?? HIDDEN_IDENTITY_LABEL,
      count,
    ])
  );
}

function anonymizeDmDerivedInsights(
  insights: NonNullable<ParsedExportData["insights"]>
): NonNullable<ParsedExportData["insights"]> {
  const sanitized = { ...insights };

  // These optional indexes join DM activity directly back to named accounts.
  // The base network/account collections remain intact; cloud saves with hidden
  // thread names can rebuild non-sensitive aggregate views from those fields.
  delete sanitized.dmReceiptByUsername;
  delete sanitized.canonicalAccounts;
  delete sanitized.directDmThreadRecords;

  sanitized.dmRelationshipInsights = insights.dmRelationshipInsights.map(
    (relationship) => {
      const labels = buildAnonymousLabels([
        ...Object.keys(relationship.messageShareBySender),
        relationship.firstMessageSender,
        relationship.lastMessageSender,
      ]);
      return {
        ...relationship,
        threadTitle: relationship.isGroup ? "Group chat" : "Direct message",
        messageShareBySender: anonymizeNamedCounts(
          relationship.messageShareBySender,
          labels
        ),
        firstMessageSender: relationship.firstMessageSender
          ? labels.get(relationship.firstMessageSender)
          : undefined,
        lastMessageSender: relationship.lastMessageSender
          ? labels.get(relationship.lastMessageSender)
          : undefined,
      };
    }
  );

  sanitized.dmAwards = insights.dmAwards.map((award) => ({
    ...award,
    threadLabel: HIDDEN_IDENTITY_LABEL,
  }));

  sanitized.groupChats = insights.groupChats.map((group) => {
    const labels = buildAnonymousLabels([
      ...Object.keys(group.messageShare),
      ...group.roles.map((role) => role.participant),
      group.topSender,
      group.leastActive,
    ]);
    return {
      ...group,
      title: "Group chat",
      topSender: group.topSender ? labels.get(group.topSender) : undefined,
      leastActive: group.leastActive
        ? labels.get(group.leastActive)
        : undefined,
      messageShare: anonymizeNamedCounts(group.messageShare, labels),
      roles: group.roles.map((role) => ({
        ...role,
        participant:
          labels.get(role.participant) ?? HIDDEN_IDENTITY_LABEL,
      })),
    };
  });

  if (insights.replyPatterns) {
    const anonymizeReplyLabel = (label: string) =>
      label === "You" ? label : HIDDEN_IDENTITY_LABEL;
    sanitized.replyPatterns = {
      ...insights.replyPatterns,
      threads: insights.replyPatterns.threads.map((thread) => ({
        ...thread,
        threadName: "Direct message",
        partnerLabel: HIDDEN_IDENTITY_LABEL,
      })),
      fastestResponder: insights.replyPatterns.fastestResponder
        ? {
            ...insights.replyPatterns.fastestResponder,
            label: anonymizeReplyLabel(
              insights.replyPatterns.fastestResponder.label
            ),
          }
        : undefined,
      slowestResponder: insights.replyPatterns.slowestResponder
        ? {
            ...insights.replyPatterns.slowestResponder,
            label: anonymizeReplyLabel(
              insights.replyPatterns.slowestResponder.label
            ),
          }
        : undefined,
      longestGhostGap: insights.replyPatterns.longestGhostGap
        ? {
            ...insights.replyPatterns.longestGhostGap,
            label: anonymizeReplyLabel(
              insights.replyPatterns.longestGhostGap.label
            ),
          }
        : undefined,
      topStarter: insights.replyPatterns.topStarter
        ? {
            ...insights.replyPatterns.topStarter,
            label: anonymizeReplyLabel(insights.replyPatterns.topStarter.label),
          }
        : undefined,
      topEnder: insights.replyPatterns.topEnder
        ? {
            ...insights.replyPatterns.topEnder,
            label: anonymizeReplyLabel(insights.replyPatterns.topEnder.label),
          }
        : undefined,
    };
  }

  sanitized.hallOfFame = insights.hallOfFame?.map((award) => ({
    ...award,
    winnerLabel: HIDDEN_IDENTITY_LABEL,
    winnerUsername: undefined,
  }));
  sanitized.yearbook = insights.yearbook?.map((card) => ({
    ...card,
    winnerLabel: HIDDEN_IDENTITY_LABEL,
    winnerUsername: undefined,
  }));
  sanitized.shareCards = insights.shareCards.map((card) => ({
    ...card,
    hideNames: true,
    sensitiveLines: undefined,
  }));

  return sanitized;
}

function sanitizeInsightsForCloudSave(
  insights: ParsedExportData["insights"],
  showThreadNames: boolean
): ParsedExportData["insights"] {
  if (!insights) return null;
  const searchWrapped = insights.searchWrapped
    ? {
        ...insights.searchWrapped,
        topAccounts: [],
        topTerms: [],
        repeatedSearches: [],
        filesParsed: [],
      }
    : null;

  const sanitized = {
    ...insights,
    accounts: insights.accounts.map((account) => ({
      ...account,
      searchCount: undefined,
      searchAttribution: undefined,
    })),
    searchWrapped,
    yearbook: insights.yearbook?.filter((card) => card.category !== "Search"),
    dataExplorer: {
      ...insights.dataExplorer,
      files: [],
      dmThreadDebug: undefined,
      identityResolution: undefined,
      coreAnalytics: undefined,
    },
  };

  return showThreadNames
    ? sanitized
    : anonymizeDmDerivedInsights(sanitized);
}

function stripSecuritySourcePaths(
  security: ParsedExportData["security"]
): ParsedExportData["security"] {
  if (!security) return null;
  const stripEvent = (event: NonNullable<typeof security.events>[number]) => {
    const copy = { ...event };
    delete copy.sourcePath;
    return copy;
  };
  return {
    ...security,
    events: security.events?.map(stripEvent),
    suspiciousLoginAnalysis: security.suspiciousLoginAnalysis
      ? {
          ...security.suspiciousLoginAnalysis,
          flaggedEvents: security.suspiciousLoginAnalysis.flaggedEvents.map(
            (flagged) => ({ ...flagged, event: stripEvent(flagged.event) })
          ),
        }
      : undefined,
  };
}

export function sanitizeParsedForCloudSave(
  parsed: ParsedExportData,
  includeMessagePreviews: boolean,
  showThreadNames: boolean,
  includeAiMessageSamples = false
): ParsedExportDataForSave {
  const { filePaths, messages, ...rest } = parsed;
  void filePaths;
  return {
    ...rest,
    network: rest.network
      ? {
          ...rest.network,
          blockedMeta: rest.network.blockedMeta
            ? { includedInExport: rest.network.blockedMeta.includedInExport }
            : undefined,
          restrictedMeta: rest.network.restrictedMeta
            ? { includedInExport: rest.network.restrictedMeta.includedInExport }
            : undefined,
        }
      : null,
    security: stripSecuritySourcePaths(rest.security),
    insights: sanitizeInsightsForCloudSave(rest.insights, showThreadNames),
    messages: sanitizeMessages(
      messages,
      includeMessagePreviews,
      showThreadNames,
      includeAiMessageSamples
    ),
  };
}
