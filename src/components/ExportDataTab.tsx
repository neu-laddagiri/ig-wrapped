"use client";

import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import type { NetworkStats, ParsedExportData } from "@/types/instagram";
import { exportAccountsCsv, exportSummaryJson } from "@/lib/exportCsv";

interface ExportDataTabProps {
  data: ParsedExportData;
  network: NetworkStats | null;
}

export function ExportDataTab({ data, network }: ExportDataTabProps) {
  const exports = network
    ? [
        {
          label: "Don't follow me back",
          count: network.dontFollowMeBack.length,
          action: () =>
            exportAccountsCsv(
              network.dontFollowMeBack,
              "dont-follow-me-back.csv"
            ),
        },
        {
          label: "I don't follow back",
          count: network.iDontFollowBack.length,
          action: () =>
            exportAccountsCsv(
              network.iDontFollowBack,
              "i-dont-follow-back.csv"
            ),
        },
        {
          label: "Mutuals",
          count: network.mutuals.length,
          action: () => exportAccountsCsv(network.mutuals, "mutuals.csv"),
        },
        {
          label: "Followers",
          count: network.followers.length,
          action: () => exportAccountsCsv(network.followers, "followers.csv"),
        },
        {
          label: "Following",
          count: network.following.length,
          action: () => exportAccountsCsv(network.following, "following.csv"),
        },
      ]
    : [];

  const handleSummaryExport = () => {
    exportSummaryJson(
      {
        exportedAt: new Date().toISOString(),
        network: network
          ? {
              totalFollowers: network.totalFollowers,
              totalFollowing: network.totalFollowing,
              mutuals: network.mutuals.length,
              dontFollowMeBack: network.dontFollowMeBack.length,
              iDontFollowBack: network.iDontFollowBack.length,
              followBackRatio: network.followBackRatio,
            }
          : null,
        wrapped: data.wrapped,
        messages: data.messages
          ? {
              totalThreads: data.messages.totalThreads,
              totalMessages: data.messages.totalMessages,
            }
          : null,
        ads: data.ads,
        security: data.security,
        coverage: data.coverage,
      },
      "ig-wrapped-summary.json"
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
        <h3 className="font-semibold text-white">Export your analysis</h3>
        <p className="mt-2 text-sm text-white/45">
          Download CSV files and a summary JSON. All exports are generated
          locally in your browser.
        </p>
      </div>

      {!network ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-12 text-center text-sm text-white/45">
          Upload an export with network data to enable CSV exports.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exports.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.action}
              disabled={item.count === 0}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-40"
            >
              <div>
                <p className="font-medium text-white">{item.label}</p>
                <p className="text-xs text-white/40">
                  {item.count} account{item.count === 1 ? "" : "s"}
                </p>
              </div>
              <FileSpreadsheet className="h-5 w-5 text-[#DD2A7B]" />
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleSummaryExport}
        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-gradient-to-r from-[#F58529]/10 via-[#DD2A7B]/10 to-[#515BD4]/10 p-5 text-left transition hover:border-white/20"
      >
        <div>
          <p className="font-semibold text-white">Summary JSON</p>
          <p className="mt-1 text-sm text-white/45">
            Complete analysis summary with counts and coverage
          </p>
        </div>
        <FileJson className="h-6 w-6 text-[#515BD4]" />
      </button>

      <div className="flex items-center gap-2 text-xs text-white/35">
        <Download className="h-3.5 w-3.5" />
        Files download directly to your device. Nothing is sent to a server.
      </div>
    </div>
  );
}
