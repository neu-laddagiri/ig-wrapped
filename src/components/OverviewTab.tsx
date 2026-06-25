"use client";

import { useState } from "react";
import {
  FileJson,
  Files,
  Image,
  Users,
  UserMinus,
  Heart,
  Shield,
  Lightbulb,
  AlertCircle,
} from "lucide-react";
import type { ParsedExportData } from "@/types/instagram";
import type { LinkedInHelperEntry } from "@/types/instagram";
import type { OverviewAiSummaryResult } from "@/types/overviewAiSummary";
import { SummaryCard } from "@/components/SummaryCard";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { resolveInsightsBundle, INSIGHTS_BUNDLE_VERSION } from "@/lib/insightsEngine";
import { ShareWrappedCard } from "@/components/ShareWrappedCard";
import { OverviewAiSection } from "@/components/OverviewAiSection";

interface OverviewTabProps {
  data: ParsedExportData;
  fileName: string | null;
  linkedinProgress: LinkedInHelperEntry[];
  overviewAiSummary: OverviewAiSummaryResult | null;
  onOverviewAiSummaryChange: (summary: OverviewAiSummaryResult | null) => void;
}

export function OverviewTab({
  data,
  fileName,
  linkedinProgress,
  overviewAiSummary,
  onOverviewAiSummaryChange,
}: OverviewTabProps) {
  const [hideShareNames, setHideShareNames] = useState(false);
  const network = data.network;
  const insights = resolveInsightsBundle(data, linkedinProgress);
  const completeness = insights.exportCompleteness;
  const needsReupload =
    data.insights && (data.insights.version ?? 0) < INSIGHTS_BUNDLE_VERSION;

  const overallCard =
    insights.shareCards.find((c) => c.id === "overall") ??
    insights.shareCards[0];

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
    <div className="space-y-5">
      {needsReupload && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-sm text-amber-100/90">
            Re-upload and save again to unlock corrected account and DM scoring.
          </p>
        </div>
      )}

      {overallCard && (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-white">Your IG Wrapped</h3>
            <label className="flex items-center gap-2 text-xs text-white/50">
              <input
                type="checkbox"
                checked={hideShareNames}
                onChange={(e) => setHideShareNames(e.target.checked)}
                className="accent-[#DD2A7B]"
              />
              Hide names for public sharing
            </label>
          </div>
          <ShareWrappedCard
            card={overallCard}
            hideNames={hideShareNames}
            variant="hero"
            personalityTitle={insights.personality?.title}
          />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="rounded-2xl animated-gradient-border bg-[#515BD4]/10 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">Export completeness</h3>
            <p className="mt-1 text-sm text-white/45">
              {completeness.detectedCount} of {completeness.totalCategories}{" "}
              categories detected
            </p>
          </div>
          <p className="text-3xl font-bold text-white">
            {completeness.score}/100
          </p>
        </div>
        {completeness.missing.length > 0 && (
          <p className="mt-2 text-xs text-white/40">
            Missing: {completeness.missing.slice(0, 5).join(", ")}
            {completeness.missing.length > 5 ? "…" : ""}
          </p>
        )}
      </div>

      <OverviewAiSection
        parsed={data}
        linkedinProgress={linkedinProgress}
        summary={overviewAiSummary}
        onSummaryChange={onOverviewAiSummaryChange}
      />

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 text-emerald-400" />
          <div>
            <h3 className="font-semibold text-white">Privacy statement</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              Your Instagram export is parsed entirely in your browser. The raw
              ZIP is not uploaded. Optional cloud save stores only your parsed
              analysis snapshot when you choose to save — never media files or
              full message history.
            </p>
          </div>
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-[#F58529]" />
            <h3 className="font-semibold text-white">Quick recommendations</h3>
          </div>
          <ul className="space-y-1.5">
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
