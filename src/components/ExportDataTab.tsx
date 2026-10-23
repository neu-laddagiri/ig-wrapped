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
      <div className="rounded-xl border border-ig-border bg-ig-subtle p-6">
        <h3 className="font-semibold text-fg">Export your analysis</h3>
        <p className="mt-2 text-sm text-ig-muted">
          Download CSV files and a summary JSON. All exports are generated
          locally in your browser. CSVs include usernames and profile links;
          the summary JSON also includes login IPs and devices.
        </p>
      </div>

      {!network ? (
        <div className="rounded-xl border border-ig-border bg-ig-subtle px-6 py-12 text-center text-sm text-ig-muted">
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
              className="flex items-center justify-between rounded-xl border border-ig-border bg-ig-subtle p-4 text-left transition hover:border-ig-border-strong hover:bg-ig-hover disabled:opacity-40"
            >
              <div>
                <p className="font-medium text-fg">{item.label}</p>
                <p className="text-xs text-ig-muted">
                  {item.count} account{item.count === 1 ? "" : "s"}
                </p>
              </div>
              <FileSpreadsheet className="h-5 w-5 text-fg" />
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleSummaryExport}
        className="flex w-full items-center justify-between rounded-xl border border-ig-border p-5 text-left transition hover:bg-ig-hover"
      >
        <div>
          <p className="font-semibold text-fg">Summary JSON</p>
          <p className="mt-1 text-sm text-ig-muted">
            Counts and coverage, plus your security events (login IP addresses,
            devices/user agents and locations) and the advertiser and ad
            category names from your export. Treat the file as private.
          </p>
        </div>
        <FileJson className="h-6 w-6 text-fg" />
      </button>

      <div className="flex items-center gap-2 text-xs text-ig-muted">
        <Download className="h-3.5 w-3.5" />
        Files download directly to your device. Nothing is sent to a server.
      </div>
    </div>
  );
}
