"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  Cloud,
  Loader2,
  Trash2,
  FolderOpen,
  LogIn,
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
  /** Called after a saved analysis is deleted, so callers can clear stale ids. */
  onDeleted?: (id: string) => void;
}

export function SavedAnalysesTab({
  onSignIn,
  onLoadAnalysis,
  onDeleted,
}: SavedAnalysesTabProps) {
  const { user } = useAuth();
  const userId = user?.id;
  // The list remembers whose it is, so switching accounts never shows stale rows.
  const [list, setList] = useState<{
    owner: string;
    items: SavedAnalysisSummary[];
    error: string | null;
  } | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadSavedAnalyses()
      .then((result) => {
        if (!cancelled) {
          setList({ owner: userId, items: result.data, error: result.error ?? null });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setList({ owner: userId, items: [], error: "Could not load saved analyses." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const currentList = list && list.owner === userId ? list : null;
  const items = currentList?.items ?? [];
  const loading = Boolean(userId) && !currentList;
  const shownError = error ?? currentList?.error ?? null;

  if (!isSupabaseConfigured()) {
    return (
      <div className="rounded-xl border border-ig-border bg-ig-subtle px-6 py-16 text-center">
        <Cloud className="mx-auto h-10 w-10 text-ig-muted" />
        <h3 className="mt-4 text-lg font-semibold text-fg">
          Cloud save not configured
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-ig-muted">
          Add Supabase environment variables to enable saved analyses. The app
          works fully in local mode without this feature.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="px-6 py-10 text-center">
        <LogIn className="mx-auto h-10 w-10" strokeWidth={1.5} />
        <h3 className="mt-3 text-lg font-semibold">Log in to see saved analyses</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ig-muted">
          IG Wrapped works without an account. Logging in only adds saving across devices.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="mt-5 rounded-lg bg-ig-blue px-5 py-2 text-sm font-semibold text-white hover:bg-ig-blue-hover"
        >
          Log in
        </button>
      </div>
    );
  }

  const handleLoad = async (id: string) => {
    setLoadingId(id);
    setError(null);
    try {
      const result = await loadSavedAnalysisById(id);
      if (result.error || !result.data) {
        setError(result.error ?? "Could not load analysis.");
        return;
      }
      await onLoadAnalysis(result.data);
    } catch {
      setError("Could not load analysis.");
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this saved analysis permanently?")) return;
    setDeletingId(id);
    try {
      const result = await deleteSavedAnalysis(id);
      if (result.success) {
        setList((prev) =>
          prev ? { ...prev, items: prev.items.filter((i) => i.id !== id) } : prev
        );
        onDeleted?.(id);
      } else {
        setError(result.error ?? "Could not delete.");
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div id="saved-analyses-section" className="scroll-mt-28 space-y-6">
      <p className="text-xs text-ig-muted">
        Saved snapshots hold parsed stats — never your original ZIP or media files.
      </p>

      {shownError && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-ig-bad">
          {shownError}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-fg" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-ig-border bg-ig-subtle px-6 py-16 text-center">
          <Cloud className="mx-auto h-10 w-10 text-ig-muted" />
          <h3 className="mt-4 text-lg font-semibold text-fg">
            No saved analyses yet
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-ig-muted">
            Upload and parse an export, then click &quot;Save full analysis&quot;
            to store it here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-4 rounded-xl border border-ig-border bg-ig-subtle p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-fg">{item.title}</p>
                <p className="mt-0.5 text-xs text-ig-muted">
                  {item.exportName} · {item.analysisMode}
                </p>
                <p className="mt-1 text-xs text-ig-muted">
                  Saved {format(new Date(item.createdAt), "MMM d, yyyy")} ·
                  Updated {format(new Date(item.updatedAt), "MMM d, yyyy h:mm a")}
                </p>
                {(item.followerCount != null || item.followingCount != null) && (
                  <p className="mt-2 text-xs text-ig-muted">
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
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ig-blue px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-ig-blue-hover disabled:opacity-50"
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
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ig-secondary px-3 py-1.5 text-sm font-semibold text-ig-bad transition hover:bg-ig-hover disabled:opacity-50"
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