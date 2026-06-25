"use client";

import { useMemo, useState } from "react";
import {
  Eye,
  MousePointerClick,
  Video,
  FileImage,
  Building2,
  Tags,
  Shield,
  Ghost,
  Search,
} from "lucide-react";
import type { AdsPrivacyData } from "@/types/instagram";
import type { AdsPrivacyInsights } from "@/types/insights";
import { SummaryCard } from "@/components/SummaryCard";
import { formatNumber } from "@/lib/formatters";

interface AdsPrivacyTabProps {
  ads: AdsPrivacyData | null;
  adsInsights?: AdsPrivacyInsights | null;
}

const CATEGORY_PREVIEW = 20;
const ADVERTISER_PREVIEW = 30;

export function AdsPrivacyTab({ ads, adsInsights }: AdsPrivacyTabProps) {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllAdvertisers, setShowAllAdvertisers] = useState(false);
  const [advertiserQuery, setAdvertiserQuery] = useState("");

  const filteredAdvertisers = useMemo(() => {
    if (!ads) return [];
    const q = advertiserQuery.trim().toLowerCase();
    if (!q) return ads.advertiserNames;
    return ads.advertiserNames.filter((name) =>
      name.toLowerCase().includes(q)
    );
  }, [ads, advertiserQuery]);

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

  const visibleCategories = showAllCategories
    ? ads.adCategories
    : ads.adCategories.slice(0, CATEGORY_PREVIEW);

  const visibleAdvertisers = showAllAdvertisers
    ? filteredAdvertisers
    : filteredAdvertisers.slice(0, ADVERTISER_PREVIEW);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          label="Ads viewed"
          value={formatNumber(ads.adsViewed)}
          icon={Eye}
          accent="pink"
        />
        <SummaryCard
          label="Ads clicked"
          value={formatNumber(ads.adsClicked)}
          icon={MousePointerClick}
          accent="orange"
        />
        <SummaryCard
          label="Videos watched"
          value={formatNumber(ads.videosWatched)}
          icon={Video}
          accent="purple"
        />
        <SummaryCard
          label="Posts viewed"
          value={formatNumber(ads.postsViewed)}
          icon={FileImage}
          accent="blue"
        />
        <SummaryCard
          label="Advertisers"
          value={formatNumber(ads.advertisersCount)}
          icon={Building2}
          accent="pink"
        />
        <SummaryCard
          label="Ad categories"
          value={formatNumber(ads.adCategoriesCount)}
          icon={Tags}
          accent="green"
        />
      </div>

      <p className="text-xs text-white/35">
        These categories and advertisers come from Instagram&apos;s official
        export. Availability depends on what Instagram included in your download.
      </p>

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
            <>
              <ul className="mt-4 flex flex-wrap gap-2">
                {visibleCategories.map((cat) => (
                  <li
                    key={cat}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70"
                  >
                    {cat}
                  </li>
                ))}
              </ul>
              {ads.adCategories.length > CATEGORY_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowAllCategories((v) => !v)}
                  className="mt-3 text-xs font-medium text-[#DD2A7B] hover:underline"
                >
                  {showAllCategories
                    ? "Show less"
                    : `Show all (${ads.adCategories.length})`}
                </button>
              )}
            </>
          ) : (
            <p className="mt-4 text-sm text-white/45">
              No ad categories found in this export.
            </p>
          )}
        </div>
      </div>

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

        {ads.advertiserNames.length > 0 ? (
          <>
            {ads.advertiserNames.length > 8 && (
              <div className="relative mt-4 max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  type="search"
                  value={advertiserQuery}
                  onChange={(e) => setAdvertiserQuery(e.target.value)}
                  placeholder="Search advertisers…"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#DD2A7B]/40"
                />
              </div>
            )}

            {filteredAdvertisers.length > 0 ? (
              <>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleAdvertisers.map((name) => (
                    <li
                      key={name}
                      className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm text-white/70"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
                {filteredAdvertisers.length > ADVERTISER_PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setShowAllAdvertisers((v) => !v)}
                    className="mt-3 text-xs font-medium text-[#DD2A7B] hover:underline"
                  >
                    {showAllAdvertisers
                      ? "Show less"
                      : `Show all (${filteredAdvertisers.length})`}
                  </button>
                )}
              </>
            ) : (
              <p className="mt-4 text-sm text-white/45">
                No advertisers match your search.
              </p>
            )}
          </>
        ) : (
          <p className="mt-4 text-sm text-white/45">
            No advertiser names found in this export.
          </p>
        )}
      </div>

      {adsInsights && adsInsights.brandsStalkingYou.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h3 className="font-semibold text-white">Brands stalking you</h3>
          <p className="mt-1 text-xs text-white/40">
            Instagram&apos;s export suggests these advertisers may have used your
            activity.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {adsInsights.brandsStalkingYou.slice(0, 20).map((name) => (
              <li
                key={name}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70"
              >
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {adsInsights &&
        Object.entries(adsInsights.themedCategories).some(
          ([, v]) => v.length > 0
        ) && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <h3 className="font-semibold text-white">Categories by theme</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {Object.entries(adsInsights.themedCategories)
                .filter(([, items]) => items.length > 0)
                .map(([theme, items]) => (
                  <div key={theme}>
                    <p className="text-xs font-medium uppercase text-white/40">
                      {theme}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {items.slice(0, 8).map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/60"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
    </div>
  );
}
