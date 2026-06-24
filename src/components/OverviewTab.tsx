"use client";

import {
  FileJson,
  Files,
  Image,
  Users,
  UserMinus,
  Heart,
  Shield,
  Lightbulb,
} from "lucide-react";
import type { ParsedExportData } from "@/types/instagram";
import { SummaryCard } from "@/components/SummaryCard";
import { formatNumber, formatPercent } from "@/lib/formatters";

interface OverviewTabProps {
  data: ParsedExportData;
  fileName: string | null;
}

export function OverviewTab({ data, fileName }: OverviewTabProps) {
  const network = data.network;

  const recommendations = [
    network && network.dontFollowMeBack.length > 0
      ? "Review accounts that don't follow you back."
      : null,
    data.ads && data.ads.advertisersCount > 0
      ? "Check advertisers using your data."
      : null,
    data.security && data.security.loginCount > 0
      ? "Review login activity for unfamiliar sessions."
      : null,
    network && network.mutuals.length > 0
      ? "Use LinkedIn Helper manually for networking with mutuals."
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Export status"
          value={fileName ? "Loaded" : "—"}
          sublabel={fileName ?? "No file"}
          icon={Files}
          accent="green"
        />
        <SummaryCard
          label="Total files"
          value={formatNumber(data.totalFiles)}
          sublabel={`${formatNumber(data.jsonFiles)} JSON · ${formatNumber(data.mediaFiles)} media`}
          icon={FileJson}
          accent="blue"
        />
        <SummaryCard
          label="Followers"
          value={network ? formatNumber(network.totalFollowers) : "—"}
          sublabel={network ? `${formatNumber(network.mutuals.length)} mutuals` : "Not found"}
          icon={Users}
          accent="pink"
        />
        <SummaryCard
          label="Following"
          value={network ? formatNumber(network.totalFollowing) : "—"}
          sublabel={
            network
              ? `${formatPercent(network.followBackRatio)} follow-back`
              : "Not found"
          }
          icon={UserMinus}
          accent="orange"
        />
      </div>

      {data.wrapped && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Liked posts"
            value={formatNumber(data.wrapped.likedPosts)}
            icon={Heart}
            accent="pink"
          />
          <SummaryCard
            label="Stories viewed"
            value={formatNumber(data.wrapped.storiesViewed)}
            icon={Image}
            accent="purple"
          />
          <SummaryCard
            label="DM threads"
            value={data.messages ? formatNumber(data.messages.totalThreads) : "—"}
            icon={Files}
            accent="blue"
          />
          <SummaryCard
            label="Ads viewed"
            value={data.ads ? formatNumber(data.ads.adsViewed) : "—"}
            icon={Shield}
            accent="orange"
          />
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 text-emerald-400" />
          <div>
            <h3 className="font-semibold text-white">Privacy statement</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              Your Instagram export is parsed entirely in your browser. The raw
              ZIP is not uploaded. Optional cloud save stores only your parsed
              analysis snapshot when you choose to save — never media files or
              message text.
            </p>
          </div>
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="mb-4 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-[#F58529]" />
            <h3 className="font-semibold text-white">Quick recommendations</h3>
          </div>
          <ul className="space-y-2">
            {recommendations.map((rec) => (
              <li
                key={rec}
                className="flex items-start gap-2 text-sm text-white/55"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-[#F58529] to-[#DD2A7B]" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.errors.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-200">
          <p className="font-medium">Parsing notes</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-200/80">
            {data.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
