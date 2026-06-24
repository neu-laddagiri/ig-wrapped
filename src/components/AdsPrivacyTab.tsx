"use client";

import {
  Eye,
  MousePointerClick,
  Video,
  FileImage,
  Building2,
  Tags,
  Shield,
  Ghost,
} from "lucide-react";
import type { AdsPrivacyData } from "@/types/instagram";
import { SummaryCard } from "@/components/SummaryCard";
import { formatNumber } from "@/lib/formatters";

interface AdsPrivacyTabProps {
  ads: AdsPrivacyData | null;
}

export function AdsPrivacyTab({ ads }: AdsPrivacyTabProps) {
  if (!ads) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
        <Eye className="mx-auto h-10 w-10 text-white/20" />
        <h3 className="mt-4 text-lg font-semibold text-white">
          No ads data found
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
          Ad-related files from{" "}
          <code className="text-white/60">ads_information/</code> were not
          detected in this export.
        </p>
      </div>
    );
  }

  const privacyScore = Math.max(
    0,
    100 -
      Math.min(50, ads.advertisersCount * 2) -
      Math.min(30, ads.adCategoriesCount) -
      Math.min(20, Math.floor(ads.adsClicked / 10))
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="Ads viewed" value={formatNumber(ads.adsViewed)} icon={Eye} accent="pink" />
        <SummaryCard label="Ads clicked" value={formatNumber(ads.adsClicked)} icon={MousePointerClick} accent="orange" />
        <SummaryCard label="Videos watched" value={formatNumber(ads.videosWatched)} icon={Video} accent="purple" />
        <SummaryCard label="Posts viewed" value={formatNumber(ads.postsViewed)} icon={FileImage} accent="blue" />
        <SummaryCard label="Advertisers" value={formatNumber(ads.advertisersCount)} icon={Building2} accent="pink" />
        <SummaryCard label="Ad categories" value={formatNumber(ads.adCategoriesCount)} icon={Tags} accent="green" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#515BD4]" />
            <h3 className="font-semibold text-white">Privacy score</h3>
          </div>
          <p className="mt-4 text-4xl font-bold text-white">{privacyScore}/100</p>
          <p className="mt-2 text-sm text-white/45">
            A rough estimate based on advertiser count, ad categories, and click
            activity. Lower advertiser exposure = higher score.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6">
          <div className="flex items-center gap-2">
            <Tags className="h-5 w-5 text-[#DD2A7B]" />
            <h3 className="font-semibold text-white">
              What Instagram thinks you like
            </h3>
          </div>
          {ads.adCategories.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {ads.adCategories.slice(0, 12).map((cat) => (
                <li
                  key={cat}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70"
                >
                  {cat}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-white/45">
              No ad category data found. Future versions will provide deeper
              interest profiling.
            </p>
          )}
        </div>
      </div>

      {ads.advertiserNames.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center gap-2">
            <Ghost className="h-5 w-5 text-[#F58529]" />
            <h3 className="font-semibold text-white">
              Advertisers using your activity
            </h3>
          </div>
          <p className="mt-1 text-xs text-white/40">
            Companies that may have targeted you based on your Instagram activity
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ads.advertiserNames.slice(0, 18).map((name) => (
              <li
                key={name}
                className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-white/70"
              >
                {name}
              </li>
            ))}
          </ul>
          {ads.advertiserNames.length > 18 && (
            <p className="mt-3 text-xs text-white/35">
              +{ads.advertiserNames.length - 18} more advertisers
            </p>
          )}
        </div>
      )}
    </div>
  );
}
