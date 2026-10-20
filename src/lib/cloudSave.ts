import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  AnalysisSnapshot,
  CloudSaveResult,
  CreateSnapshotInput,
  SavedAnalysisRow,
  SavedAnalysisSummary,
  SnapshotCounts,
} from "@/types/analysis";
import {
  ANALYSIS_SNAPSHOT_VERSION,
  sanitizeParsedForCloudSave,
} from "@/types/analysis";
import type { LinkedInHelperEntry } from "@/types/instagram";

/** Columns for list views — never the full snapshot JSON. */
const LIST_COLUMNS = [
  "id",
  "title",
  "export_name",
  "instagram_username",
  "analysis_mode",
  "created_at",
  "updated_at",
  "counts:full_analysis_json->counts",
  "followers:full_analysis_json->parsed->network->totalFollowers",
  "following:full_analysis_json->parsed->network->totalFollowing",
].join(", ");

interface SavedAnalysisListRow {
  id: string;
  title: string | null;
  export_name: string | null;
  instagram_username: string | null;
  analysis_mode: string | null;
  created_at: string;
  updated_at: string;
  counts: Partial<SnapshotCounts> | null;
  followers: unknown;
  following: unknown;
}

function friendlyError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("saved_analyses_limit")) {
    return "You can keep up to 50 saved analyses. Delete one and try again.";
  }
  if (
    lower.includes("saved_analyses_json_size") ||
    lower.includes("payload too large")
  ) {
    return "This analysis is too large to save to the cloud (limit 20 MB).";
  }
  if (lower.includes("statement timeout")) {
    return "Saving took too long — the analysis may be too large. Try again.";
  }
  if (message.includes("JWT") || message.includes("session")) {
    return "Your session expired. Please sign in again.";
  }
  if (message.includes("row-level security") || message.includes("RLS")) {
    return "You do not have permission to access this saved analysis.";
  }
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return "Could not reach the cloud save service. Check your connection.";
  }
  return message;
}

function requireClient() {
  if (!isSupabaseConfigured()) {
    throw new Error("Cloud save is not configured yet.");
  }
  const supabase = createClient();
  if (!supabase) {
    throw new Error("Cloud save is not configured yet.");
  }
  return supabase;
}

export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

function stripFilePaths(
  parsed: CreateSnapshotInput["parsedData"],
  includeMessagePreviews: boolean,
  showThreadNames: boolean,
  includeAiMessageSamples: boolean
) {
  return sanitizeParsedForCloudSave(
    parsed,
    includeMessagePreviews,
    showThreadNames,
    includeAiMessageSamples
  );
}

function guessInstagramUsername(
  parsed: CreateSnapshotInput["parsedData"]
): string | null {
  const paths = parsed.filePaths ?? [];
  for (const p of paths) {
    const lower = p.toLowerCase();
    if (lower.includes("personal_information")) {
      const match = lower.match(/instagram[_-]?([a-z0-9._]+)/i);
      if (match?.[1]) return match[1];
    }
  }
  return null;
}

export function createAnalysisSnapshot(
  input: CreateSnapshotInput
): AnalysisSnapshot {
  const parsed = stripFilePaths(
    input.parsedData,
    input.dmShowFirstMessagePreview,
    input.dmShowThreadNames,
    input.includeAiMessageSamples ?? false
  );
  const network = input.parsedData.network;
  return {
    version: ANALYSIS_SNAPSHOT_VERSION,
    exportName: input.fileName,
    fileFingerprint: input.fileFingerprint,
    analysisMode: input.analysisMode ?? "full",
    instagramUsername: guessInstagramUsername(input.parsedData),
    activeTab: input.activeTab,
    dmShowThreadNames: input.dmShowThreadNames,
    dmShowFirstMessagePreview: input.dmShowFirstMessagePreview,
    includeAiMessageSamples: input.includeAiMessageSamples ?? false,
    expandedGroupThreads: input.expandedGroupThreads,
    dmAiSummaries: input.dmAiSummaries ?? {},
    overviewAiSummary: input.overviewAiSummary ?? null,
    parsedAt: new Date().toISOString(),
    counts: {
      followers: network?.totalFollowers ?? null,
      following: network?.totalFollowing ?? null,
      mutuals: network?.mutuals?.length ?? null,
    },
    parsed,
  };
}

function countOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function rowToSummary(row: SavedAnalysisListRow): SavedAnalysisSummary {
  return {
    id: row.id,
    title: row.title ?? row.export_name ?? "Saved analysis",
    exportName: row.export_name ?? "—",
    instagramUsername: row.instagram_username ?? null,
    analysisMode: row.analysis_mode ?? "full",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    followerCount: countOrNull(row.counts?.followers ?? row.followers),
    followingCount: countOrNull(row.counts?.following ?? row.following),
    mutualCount: countOrNull(row.counts?.mutuals),
  };
}

export async function saveFullAnalysisToCloud(params: {
  snapshot: AnalysisSnapshot;
  linkedinProgress: LinkedInHelperEntry[];
  existingId?: string | null;
  title?: string;
}): Promise<CloudSaveResult> {
  try {
    const supabase = requireClient();
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Sign in to save your analysis." };
    }

    const payload = {
      user_id: user.id,
      title:
        params.title ??
        params.snapshot.exportName ??
        "IG Wrapped Analysis",
      export_name: params.snapshot.exportName,
      instagram_username: params.snapshot.instagramUsername,
      analysis_mode: params.snapshot.analysisMode,
      file_fingerprint: params.snapshot.fileFingerprint,
      full_analysis_json: params.snapshot,
      linkedin_progress_json: params.linkedinProgress,
    };

    if (params.existingId) {
      const { data, error } = await supabase
        .from("saved_analyses")
        .update(payload)
        .eq("id", params.existingId)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();

      if (error) {
        return { success: false, error: friendlyError(error.message) };
      }
      if (data) return { success: true, id: data.id };
      // The row was deleted (or belongs to another account) — save a new copy.
    }

    const { data, error } = await supabase
      .from("saved_analyses")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      return { success: false, error: friendlyError(error.message) };
    }
    return { success: true, id: data.id };
  } catch (err) {
    return {
      success: false,
      error: friendlyError(
        err instanceof Error ? err.message : "Could not save analysis."
      ),
    };
  }
}

export async function loadSavedAnalyses(): Promise<{
  data: SavedAnalysisSummary[];
  error?: string;
}> {
  try {
    const supabase = requireClient();
    const user = await getCurrentUser();
    if (!user) {
      return { data: [], error: "Sign in to view saved analyses." };
    }

    const { data, error } = await supabase
      .from("saved_analyses")
      .select(LIST_COLUMNS)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      return { data: [], error: friendlyError(error.message) };
    }

    return {
      data: ((data ?? []) as unknown as SavedAnalysisListRow[]).map(rowToSummary),
    };
  } catch (err) {
    return {
      data: [],
      error: friendlyError(
        err instanceof Error ? err.message : "Could not load saved analyses."
      ),
    };
  }
}

export async function loadSavedAnalysisById(id: string): Promise<{
  data: SavedAnalysisRow | null;
  error?: string;
}> {
  try {
    const supabase = requireClient();
    const user = await getCurrentUser();
    if (!user) {
      return { data: null, error: "Sign in to load saved analyses." };
    }

    const { data, error } = await supabase
      .from("saved_analyses")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return { data: null, error: friendlyError(error.message) };
    }
    const row = data as SavedAnalysisRow | null;
    if (!row) {
      return { data: null, error: "Saved analysis not found. It may have been deleted." };
    }
    if (!row.full_analysis_json?.parsed) {
      return { data: null, error: "This saved analysis is incomplete and can't be loaded." };
    }
    return { data: row };
  } catch (err) {
    return {
      data: null,
      error: friendlyError(
        err instanceof Error ? err.message : "Could not load analysis."
      ),
    };
  }
}

export async function deleteSavedAnalysis(
  id: string
): Promise<CloudSaveResult> {
  try {
    const supabase = requireClient();
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Sign in to delete saved analyses." };
    }

    const { error } = await supabase
      .from("saved_analyses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return { success: false, error: friendlyError(error.message) };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: friendlyError(
        err instanceof Error ? err.message : "Could not delete analysis."
      ),
    };
  }
}

export async function updateSavedAnalysis(params: {
  id: string;
  snapshot: AnalysisSnapshot;
  linkedinProgress: LinkedInHelperEntry[];
  title?: string;
}): Promise<CloudSaveResult> {
  return saveFullAnalysisToCloud({
    snapshot: params.snapshot,
    linkedinProgress: params.linkedinProgress,
    existingId: params.id,
    title: params.title,
  });
}

export { isSupabaseConfigured };
