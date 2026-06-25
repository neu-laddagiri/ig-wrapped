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
  expandedGroupThreads: string[];
  dmAiSummaries?: DmAiSummariesMap;
  overviewAiSummary?: OverviewAiSummaryResult | null;
  analysisMode?: string;
}

function enrichThreadForCloudSave(
  thread: DmThreadAnalytics,
  includePreviews: boolean,
  showThreadNames: boolean
): DmThreadAnalytics {
  const {
    textMessages,
    firstMessagePreview,
    aiSummarySample: existingSample,
    ...rest
  } = thread;

  let aiSummarySample = existingSample;
  if (textMessages?.length) {
    const built = buildAiSummarySampleForCloud(textMessages, {
      mostActiveMonth: thread.mostActiveMonth,
      isGroup: thread.isGroupChat,
      showThreadNames,
    });
    if (built) aiSummarySample = built;
  }

  const result: DmThreadAnalytics = {
    ...rest,
    aiSummarySample,
  };

  if (includePreviews && firstMessagePreview) {
    result.firstMessagePreview = firstMessagePreview;
  }

  return result;
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

export function sanitizeParsedForCloudSave(
  parsed: ParsedExportData,
  includeMessagePreviews: boolean,
  showThreadNames: boolean
): ParsedExportDataForSave {
  const { filePaths: _removed, messages, ...rest } = parsed;
  return {
    ...rest,
    messages: sanitizeMessages(messages, includeMessagePreviews, showThreadNames),
  };
}
