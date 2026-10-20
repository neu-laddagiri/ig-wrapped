"use client";

import { useState } from "react";
import {
  Cloud,
  CloudUpload,
  FolderOpen,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  createAnalysisSnapshot,
  saveFullAnalysisToCloud,
  deleteSavedAnalysis,
} from "@/lib/cloudSave";
import type { DashboardTabId } from "@/components/DashboardTabs";
import type { ParsedExportData, LinkedInHelperEntry } from "@/types/instagram";
import type { DmAiSummariesMap } from "@/types/dmAiSummary";
import type { OverviewAiSummaryResult } from "@/types/overviewAiSummary";
import { MAX_AI_SAMPLE_MESSAGES } from "@/lib/dmMessageSampling";

interface SaveFullAnalysisPanelProps {
  parsedData: ParsedExportData;
  fileName: string;
  fileFingerprint: string;
  linkedinProgress: LinkedInHelperEntry[];
  activeTab: DashboardTabId;
  dmShowThreadNames: boolean;
  dmShowFirstMessagePreview: boolean;
  expandedGroupThreads: string[];
  dmAiSummaries: DmAiSummariesMap;
  overviewAiSummary: OverviewAiSummaryResult | null;
  currentSavedId: string | null;
  isDemoMode?: boolean;
  onSignIn: () => void;
  onSaved: (id: string) => void;
  onDeleted: () => void;
  onLoadSaved: () => void;
  onClearLocal: () => void;
}

export function SaveFullAnalysisPanel({
  parsedData,
  fileName,
  fileFingerprint,
  linkedinProgress,
  activeTab,
  dmShowThreadNames,
  dmShowFirstMessagePreview,
  expandedGroupThreads,
  dmAiSummaries,
  overviewAiSummary,
  currentSavedId,
  isDemoMode = false,
  onSignIn,
  onSaved,
  onDeleted,
  onLoadSaved,
  onClearLocal,
}: SaveFullAnalysisPanelProps) {
  const { user, isConfigured } = useAuth();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  if (!isConfigured) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-start gap-3">
          <Cloud className="mt-0.5 h-5 w-5 text-white/30" />
          <div>
            <p className="text-sm font-medium text-white">
              Cloud save not configured yet
            </p>
            <p className="mt-1 text-xs text-white/45">
              Add Supabase environment variables to enable optional account
              saving. Your analysis still works fully in local mode.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    if (!user) {
      onSignIn();
      return;
    }

    if (isDemoMode) {
      const ok = confirm(
        "Save this demo analysis to your account? It uses synthetic data only."
      );
      if (!ok) return;
    }

    if (dmShowFirstMessagePreview) {
      const ok = confirm(
        "You have message previews enabled. Saving will include visible first-message previews in your cloud snapshot. Continue?"
      );
      if (!ok) return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const snapshot = createAnalysisSnapshot({
        parsedData,
        fileName,
        fileFingerprint,
        linkedinProgress,
        activeTab,
        dmShowThreadNames,
        dmShowFirstMessagePreview,
        expandedGroupThreads,
        dmAiSummaries,
        overviewAiSummary,
        analysisMode: isDemoMode ? "demo" : "full",
      });

      const result = await saveFullAnalysisToCloud({
        snapshot,
        linkedinProgress,
        existingId: currentSavedId,
      });

      if (result.success && result.id) {
        setMessage({ type: "success", text: "Full analysis saved to your account." });
        onSaved(result.id);
      } else {
        setMessage({
          type: "error",
          text: result.error ?? "Could not save analysis.",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Could not save analysis." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentSavedId || !user) return;
    if (!confirm("Delete this saved analysis from your account?")) return;

    setDeleting(true);
    setMessage(null);
    try {
      const result = await deleteSavedAnalysis(currentSavedId);
      if (result.success) {
        setMessage({ type: "success", text: "Saved analysis deleted." });
        onDeleted();
      } else {
        setMessage({
          type: "error",
          text: result.error ?? "Could not delete analysis.",
        });
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#F58529]/20 via-[#DD2A7B]/20 to-[#515BD4]/20">
          <CloudUpload className="h-5 w-5 text-[#DD2A7B]" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-white">
            {user ? "Save your full analysis" : "Want to save this analysis?"}
          </h3>
          <p className="mt-1 text-sm text-white/45">
            {user
              ? "Save your parsed dashboard, network data, insights, and LinkedIn Helper progress."
              : "Create an optional account to save your full IG Wrapped analysis and LinkedIn Helper progress across devices."}
          </p>
          <p className="mt-2 text-xs text-white/35">
            {isDemoMode
              ? "Demo mode uses synthetic data. Cloud save is optional — use “Save full analysis” only if you want a demo snapshot on your account."
              : `Saves your parsed dashboard: follower/following lists, DM thread names and participants with message counts, up to ${MAX_AI_SAMPLE_MESSAGES} sampled messages per thread (emails and phone numbers masked; short threads may be saved in full) so AI summaries work later, your top search terms, ad interests and advertisers, security event types and dates, LinkedIn Helper notes, and any AI summaries. Not saved: your ZIP, media files, full message histories, or login IP addresses, locations and devices.`}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!user ? (
          <button
            type="button"
            onClick={onSignIn}
            className="rounded-full animated-gradient-bg px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Sign in to save
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full animated-gradient-bg px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CloudUpload className="h-4 w-4" />
              )}
              {currentSavedId
                ? "Update saved analysis"
                : isDemoMode
                  ? "Save demo analysis"
                  : "Save full analysis"}
            </button>
            <button
              type="button"
              onClick={onLoadSaved}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
            >
              <FolderOpen className="h-4 w-4" />
              Load saved analyses
            </button>
            {currentSavedId && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/15 disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete saved copy
              </button>
            )}
            <button
              type="button"
              onClick={onClearLocal}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/50 transition hover:bg-white/5 hover:text-white/70"
            >
              Clear local session
            </button>
          </>
        )}
      </div>

      {message && (
        <p
          className={`mt-3 flex items-center gap-2 text-sm ${
            message.type === "success" ? "text-emerald-400" : "text-red-300"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          {message.text}
        </p>
      )}
    </div>
  );
}
