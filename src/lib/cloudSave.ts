import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  AnalysisSnapshot,
  CloudSaveResult,
  CreateSnapshotInput,
  SavedAnalysisRow,
  SavedAnalysisSummary,
} from "@/types/analysis";
import {
  ANALYSIS_SNAPSHOT_VERSION,
  sanitizeParsedForCloudSave,
} from "@/types/analysis";
import type { LinkedInHelperEntry } from "@/types/instagram";

function friendlyError(message: string): string {
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
    parsed,
  };
}

function rowToSummary(row: SavedAnalysisRow): SavedAnalysisSummary {
  const snapshot = row.full_analysis_json;
  const network = snapshot?.parsed?.network;
  return {
    id: row.id,
    title: row.title ?? row.export_name ?? "Saved analysis",
    exportName: row.export_name ?? snapshot?.exportName ?? "—",
    instagramUsername:
      row.instagram_username ?? snapshot?.instagramUsername ?? null,
    analysisMode: row.analysis_mode ?? snapshot?.analysisMode ?? "full",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    followerCount: network?.totalFollowers ?? null,
    followingCount: network?.totalFollowing ?? null,
    mutualCount: network?.mutuals?.length ?? null,
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
        .single();

      if (error) {
        return { success: false, error: friendlyError(error.message) };
      }
      return { success: true, id: data.id };
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
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      return { data: [], error: friendlyError(error.message) };
    }

    return {
      data: (data as SavedAnalysisRow[]).map(rowToSummary),
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
      .single();

    if (error) {
      return { data: null, error: friendlyError(error.message) };
    }
    return { data: data as SavedAnalysisRow };
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
