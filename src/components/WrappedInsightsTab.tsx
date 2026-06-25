"use client";

import type { ElementType } from "react";
import {
  Heart,
  MessageSquare,
  Bookmark,
  CircleDot,
  ThumbsUp,
  BarChart3,
  Smile,
  HelpCircle,
  Video,
  Eye,
  Sparkles,
  TrendingUp,
  Brain,
} from "lucide-react";
import type { NetworkStats, WrappedInsights, MostActiveEraData } from "@/types/instagram";
import { SummaryCard } from "@/components/SummaryCard";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { MostActiveEraCard, MostActiveMonthsChart } from "@/components/MostActiveEraCard";

import type { AdsPrivacyInsights, ContentDietResult } from "@/types/insights";

interface WrappedInsightsTabProps {
  wrapped: WrappedInsights | null;
  network: NetworkStats | null;
  mostActiveEra: MostActiveEraData | null;
  contentDiet?: ContentDietResult | null;
  adsInsights?: AdsPrivacyInsights | null;
}

function InsightPlaceholder({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: ElementType;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/40">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold text-white">{value}</p>
          <p className="mt-2 text-xs leading-relaxed text-white/40">
            {description}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#F58529]/20 via-[#DD2A7B]/15 to-[#515BD4]/20">
          <Icon className="h-5 w-5 text-[#DD2A7B]" />
        </div>
      </div>
    </div>
  );
}

export function WrappedInsightsTab({
  wrapped,
  network,
  mostActiveEra,
  contentDiet,
  adsInsights,
}: WrappedInsightsTabProps) {
  if (!wrapped) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
        <Sparkles className="mx-auto h-10 w-10 text-white/20" />
        <h3 className="mt-4 text-lg font-semibold text-white">
          No activity data found
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
          Activity files from{" "}
          <code className="text-white/60">your_instagram_activity/</code> were
          not detected in this export.
        </p>
      </div>
    );
  }

  const totalInteractions =
    wrapped.likedPosts +
    wrapped.likedComments +
    wrapped.postComments +
    wrapped.savedPosts +
    wrapped.storiesViewed +
    wrapped.storyLikes;

  const topType = [
    { label: "Liked posts", count: wrapped.likedPosts },
    { label: "Stories viewed", count: wrapped.storiesViewed },
    { label: "Post comments", count: wrapped.postComments },
    { label: "Saved posts", count: wrapped.savedPosts },
    { label: "Story likes", count: wrapped.storyLikes },
  ].sort((a, b) => b.count - a.count)[0];

  const personality =
    wrapped.storiesViewed > wrapped.likedPosts
      ? "Story Stalker 👀"
      : wrapped.likedPosts > wrapped.savedPosts
        ? "Generous Liker ❤️"
        : wrapped.savedPosts > 50
          ? "Curator 📌"
          : "Quiet Scroller 🌙";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Liked posts" value={formatNumber(wrapped.likedPosts)} icon={Heart} accent="pink" />
        <SummaryCard label="Liked comments" value={formatNumber(wrapped.likedComments)} icon={ThumbsUp} accent="orange" />
        <SummaryCard label="Post comments" value={formatNumber(wrapped.postComments)} icon={MessageSquare} accent="blue" />
        <SummaryCard label="Saved posts" value={formatNumber(wrapped.savedPosts)} icon={Bookmark} accent="purple" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Stories viewed" value={formatNumber(wrapped.storiesViewed)} icon={CircleDot} accent="pink" />
        <SummaryCard label="Story likes" value={formatNumber(wrapped.storyLikes)} icon={Heart} accent="orange" />
        <SummaryCard label="Poll interactions" value={formatNumber(wrapped.pollInteractions)} icon={BarChart3} accent="blue" />
        <SummaryCard label="Emoji sliders" value={formatNumber(wrapped.emojiSliderInteractions)} icon={Smile} accent="purple" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="Quizzes" value={formatNumber(wrapped.quizzes)} icon={HelpCircle} accent="green" />
        <SummaryCard label="Videos watched" value={formatNumber(wrapped.videosWatched)} icon={Video} accent="pink" />
        <SummaryCard label="Posts viewed" value={formatNumber(wrapped.postsViewed)} icon={Eye} accent="blue" />
      </div>

      <div>
        <h3 className="mb-4 text-lg font-semibold text-white">
          Wrapped personality cards
        </h3>
        <p className="mb-4 text-sm text-white/45">
          Fun insights based on your available export data.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InsightPlaceholder
            title="Network cleanup score"
            value={
              network
                ? `${Math.max(0, 100 - Math.round((network.dontFollowMeBack.length / Math.max(network.totalFollowing, 1)) * 100))}/100`
                : "—"
            }
            description="Higher score means a tighter follow ratio. Based on accounts that don't follow you back."
            icon={TrendingUp}
          />
          <InsightPlaceholder
            title="Follow-back ratio"
            value={network ? formatPercent(network.followBackRatio) : "—"}
            description="Percentage of people you follow who follow you back."
            icon={Heart}
          />
          <InsightPlaceholder
            title="Parasocial score"
            value={
              totalInteractions > 0
                ? `${Math.min(99, Math.round((wrapped.storiesViewed / Math.max(totalInteractions, 1)) * 100))}%`
                : "—"
            }
            description="How much of your activity is passive story viewing vs. active engagement."
            icon={Eye}
          />
          <MostActiveEraCard era={mostActiveEra} compact />
          <InsightPlaceholder
            title="Top interaction type"
            value={topType?.count ? topType.label : "—"}
            description="Your dominant form of Instagram engagement based on export counts."
            icon={Sparkles}
          />
          <InsightPlaceholder
            title="Your IG personality"
            value={personality}
            description="A playful label derived from your activity mix. Not scientific — just fun!"
            icon={Brain}
          />
        </div>
      </div>

      {contentDiet && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h3 className="font-semibold text-white">Content Diet</h3>
          <p className="mt-1 text-sm text-[#DD2A7B]">{contentDiet.personality}</p>
          <p className="mt-2 text-xs text-white/45">{contentDiet.caption}</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {contentDiet.metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
              >
                <p className="text-[10px] uppercase text-white/35">{m.label}</p>
                <p className="text-sm font-medium text-white">{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {adsInsights && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h3 className="font-semibold text-white">Ads deep dive</h3>
          <p className="mt-1 text-xs text-white/40">{adsInsights.summary}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
              <p className="text-xs text-white/40">Ad resistance</p>
              <p className="text-lg font-bold text-white">
                {adsInsights.adResistanceScore}%
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
              <p className="text-xs text-white/40">Privacy creep score</p>
              <p className="text-lg font-bold text-white">
                {adsInsights.privacyCreepScore}
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
              <p className="text-xs text-white/40">Click rate</p>
              <p className="text-lg font-bold text-white">
                {Math.round(adsInsights.clickRate * 100)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {mostActiveEra && mostActiveEra.topMonths.length > 1 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <MostActiveMonthsChart era={mostActiveEra} />
        </div>
      )}
    </div>
  );
}
