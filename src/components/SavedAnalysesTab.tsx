"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Cloud,
  Loader2,
  Trash2,
  FolderOpen,
  LogIn,
  HardDrive,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  deleteSavedAnalysis,
  loadSavedAnalyses,
  loadSavedAnalysisById,
  isSupabaseConfigured,
} from "@/lib/cloudSave";
import type { SavedAnalysisSummary } from "@/types/analysis";
import { formatNumber } from "@/lib/formatters";

import type { SavedAnalysisRow } from "@/types/analysis";

interface SavedAnalysesTabProps {
  onSignIn: () => void;
  onLoadAnalysis: (row: SavedAnalysisRow) => void;
}

export function SavedAnalysesTab({
  onSignIn,
  onLoadAnalysis,
}: SavedAnalysesTabProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<SavedAnalysisSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const result = await loadSavedAnalyses();
    setItems(result.data);
    if (result.error) setError(result.error);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  if (!isSupabaseConfigured()) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
        <Cloud className="mx-auto h-10 w-10 text-white/20" />
        <h3 className="mt-4 text-lg font-semibold text-white">
          Cloud save not configured
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
          Add Supabase environment variables to enable saved analyses. The app
          works fully in local mode without this feature.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-start gap-3">
            <HardDrive className="mt-0.5 h-5 w-5 text-[#DD2A7B]" />
            <div>
              <h3 className="font-semibold text-white">Local mode</h3>
              <p className="mt-2 text-sm text-white/45">
                You can analyze exports without signing in. Create an optional
                account to save your full parsed analysis and LinkedIn Helper
                progress across devices.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-12 text-center">
          <LogIn className="mx-auto h-10 w-10 text-white/20" />
          <h3 className="mt-4 text-lg font-semibold text-white">
            Sign in to view saved analyses
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
            Saved analyses are stored in your account — not uploaded as raw ZIP
            files.
          </p>
          <button
            type="button"
            onClick={onSignIn}
            className="mt-6 rounded-full animated-gradient-bg px-6 py-2.5 text-sm font-semibold text-white"
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const handleLoad = async (id: string) => {
    setLoadingId(id);
    setError(null);
    const result = await loadSavedAnalysisById(id);
    if (result.error || !result.data) {
      setError(result.error ?? "Could not load analysis.");
      setLoadingId(null);
      return;
    }
    await onLoadAnalysis(result.data);
    setLoadingId(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this saved analysis permanently?")) return;
    setDeletingId(id);
    const result = await deleteSavedAnalysis(id);
    if (result.success) {
      setItems((prev) => prev.filter((i) => i.id !== id));
    } else {
      setError(result.error ?? "Could not delete.");
    }
    setDeletingId(null);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#515BD4]/20 bg-[#515BD4]/10 p-4">
        <p className="text-sm text-white/70">
          <span className="font-medium text-white">Account save enabled.</span>{" "}
          These are parsed analysis snapshots — not your original ZIP or media
          files.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#DD2A7B]" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
          <Cloud className="mx-auto h-10 w-10 text-white/20" />
          <h3 className="mt-4 text-lg font-semibold text-white">
            No saved analyses yet
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
            Upload and parse an export, then click &quot;Save full analysis&quot;
            to store it here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-white">{item.title}</p>
                <p className="mt-0.5 text-xs text-white/40">
                  {item.exportName} · {item.analysisMode}
                </p>
                <p className="mt-1 text-xs text-white/35">
                  Saved {format(new Date(item.createdAt), "MMM d, yyyy")} ·
                  Updated {format(new Date(item.updatedAt), "MMM d, yyyy h:mm a")}
                </p>
                {(item.followerCount != null || item.followingCount != null) && (
                  <p className="mt-2 text-xs text-white/50">
                    {item.followerCount != null &&
                      `${formatNumber(item.followerCount)} followers`}
                    {item.followingCount != null &&
                      ` · ${formatNumber(item.followingCount)} following`}
                    {item.mutualCount != null &&
                      ` · ${formatNumber(item.mutualCount)} mutuals`}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => handleLoad(item.id)}
                  disabled={loadingId === item.id}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10 disabled:opacity-50"
                >
                  {loadingId === item.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FolderOpen className="h-3.5 w-3.5" />
                  )}
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  disabled={deletingId === item.id}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/15 disabled:opacity-50"
                >
                  {deletingId === item.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}