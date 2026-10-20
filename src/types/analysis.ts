import type { DashboardTabId } from "@/components/DashboardTabs";
import type {
  LinkedInHelperEntry,
  ParsedExportData,
  DmAnalytics,
  DmThreadAnalytics,
  SecurityData,
  SecurityEvent,
} from "@/types/instagram";
import type { DmAiSummariesMap } from "@/types/dmAiSummary";
import type { OverviewAiSummaryResult } from "@/types/overviewAiSummary";
import { normalizeDmThreads } from "@/lib/dmThreads";
import { buildAiSummarySampleForCloud } from "@/lib/dmMessageSampling";

export const ANALYSIS_SNAPSHOT_VERSION = 6;

export interface AnalysisSnapshot {
  version: typeof ANALYSIS_SNAPSHOT_VERSION;
  exportName: string;
  fileFingerprint: string;
  analysisMode: string;
  instagramUsername: string | null;
  activeTab: DashboardTabId;
  dmShowThreadNames: boolean;
  dmShowFirstMessagePreview: boolean;
  expandedGroupThreads: string[];
  dmAiSummaries?: DmAiSummariesMap;
  overviewAiSummary?: OverviewAiSummaryResult | null;
  parsedAt: string;
  /** Small summary read by list views without downloading `parsed`. */
  counts?: SnapshotCounts;
  parsed: ParsedExportDataForSave;
}

export interface SnapshotCounts {
  followers: number | null;
  following: number | null;
  mutuals: number | null;
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
  expandedGroupThreads: string[];
  dmAiSummaries?: DmAiSummariesMap;
  overviewAiSummary?: OverviewAiSummaryResult | null;
  analysisMode?: string;
}

/** Drops local-only message text (and the AI sample) from a thread. */
function stripThreadForCloudSave(
  thread: DmThreadAnalytics,
  includePreviews: boolean
): DmThreadAnalytics {
  const result: DmThreadAnalytics = { ...thread };
  delete result.textMessages;
  delete result.aiSummarySample;
  if (!includePreviews) delete result.firstMessagePreview;
  return result;
}

function enrichThreadForCloudSave(
  thread: DmThreadAnalytics,
  includePreviews: boolean,
  showThreadNames: boolean
): DmThreadAnalytics {
  let aiSummarySample = thread.aiSummarySample;
  if (thread.textMessages?.length) {
    const built = buildAiSummarySampleForCloud(thread.textMessages, {
      mostActiveMonth: thread.mostActiveMonth,
      isGroup: thread.isGroupChat,
      showThreadNames,
    });
    if (built) aiSummarySample = built;
  }

  return {
    ...stripThreadForCloudSave(thread, includePreviews),
    aiSummarySample,
  };
}

/** Login IPs, locations and device strings never leave the browser. */
function stripSecurityEvent(event: SecurityEvent): SecurityEvent {
  const result: SecurityEvent = { ...event };
  delete result.ipAddress;
  delete result.location;
  delete result.device;
  return result;
}

function sanitizeSecurity(security: SecurityData | null): SecurityData | null {
  if (!security) return null;
  const analysis = security.suspiciousLoginAnalysis;
  return {
    ...security,
    events: security.events?.map(stripSecurityEvent),
    suspiciousLoginAnalysis: analysis
      ? {
          ...analysis,
          flaggedEvents: (analysis.flaggedEvents ?? []).map((flagged) => ({
            ...flagged,
            event: stripSecurityEvent(flagged.event),
          })),
        }
      : analysis,
  };
}

function sanitizeMessages(
  messages: DmAnalytics | null,
  includePreviews: boolean,
  showThreadNames: boolean
): DmAnalytics | null {
  if (!messages) return null;
  const sanitize = (t: DmThreadAnalytics) =>
    enrichThreadForCloudSave(t, includePreviews, showThreadNames);
  const threads = normalizeDmThreads(messages).map(sanitize);
  // Top threads also appear in `threads`, which already carries their AI samples.
  const topThreads = (
    Array.isArray(messages.topThreads) ? messages.topThreads : threads
  )
    .slice()
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, 25)
    .map((t) => stripThreadForCloudSave(t, includePreviews));
  return {
    ...messages,
    threads,
    topThreads,
  };
}

export function sanitizeParsedForCloudSave(
  parsed: ParsedExportData,
  includeMessagePreviews: boolean,
  showThreadNames: boolean
): ParsedExportDataForSave {
  const { filePaths: _removed, messages, security, ...rest } = parsed;
  return {
    ...rest,
    security: sanitizeSecurity(security),
    messages: sanitizeMessages(messages, includeMessagePreviews, showThreadNames),
  };
}
