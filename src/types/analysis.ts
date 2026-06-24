import type { DashboardTabId } from "@/components/DashboardTabs";
import type {
  LinkedInHelperEntry,
  ParsedExportData,
  DmAnalytics,
  DmThreadAnalytics,
} from "@/types/instagram";
import { normalizeDmThreads } from "@/lib/dmThreads";

export const ANALYSIS_SNAPSHOT_VERSION = 2;

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
  analysisMode?: string;
}

function sanitizeThread(
  thread: DmThreadAnalytics,
  includePreviews: boolean
): DmThreadAnalytics {
  if (includePreviews) return thread;
  const { firstMessagePreview: _removed, ...rest } = thread;
  return rest;
}

function sanitizeMessages(
  messages: DmAnalytics | null,
  includePreviews: boolean
): DmAnalytics | null {
  if (!messages) return null;
  const sanitize = (t: DmThreadAnalytics) =>
    sanitizeThread(t, includePreviews);
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
  includeMessagePreviews: boolean
): ParsedExportDataForSave {
  const { filePaths: _removed, messages, ...rest } = parsed;
  return {
    ...rest,
    messages: sanitizeMessages(messages, includeMessagePreviews),
  };
}
