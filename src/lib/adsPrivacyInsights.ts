import type { AdsPrivacyData } from "@/types/instagram";
import type { AdCategoryTheme, AdsPrivacyInsights } from "@/types/insights";

const THEME_KEYWORDS: Record<AdCategoryTheme, string[]> = {
  Lifestyle: ["lifestyle", "home", "fashion", "beauty", "food", "wellness"],
  Shopping: ["shop", "retail", "store", "commerce", "brand", "product"],
  Entertainment: ["entertainment", "music", "movie", "game", "media", "tv"],
  Fitness: ["fitness", "gym", "sport", "health", "workout", "athletic"],
  Finance: ["finance", "bank", "invest", "money", "insurance", "credit"],
  Education: ["education", "school", "learn", "course", "university"],
  Travel: ["travel", "hotel", "flight", "tourism", "vacation"],
  Tech: ["tech", "software", "app", "digital", "computer", "device"],
  Other: [],
};

function themeForCategory(cat: string): AdCategoryTheme {
  const lower = cat.toLowerCase();
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    if (theme === "Other") continue;
    if (keywords.some((k) => lower.includes(k))) return theme as AdCategoryTheme;
  }
  return "Other";
}

/**
 * Click rate (0–1) and ad resistance (0–100), or null when the export has no
 * ad-view history to compare clicks against.
 */
export function adClickStats(ads: AdsPrivacyData | null | undefined): {
  clickRate: number | null;
  resistance: number | null;
} {
  if (!ads || ads.adsViewed <= 0) return { clickRate: null, resistance: null };
  // ads_clicked and ads_viewed are separate lists, so clicks can exceed views.
  const clickRate = Math.min(1, Math.max(0, ads.adsClicked / ads.adsViewed));
  return { clickRate, resistance: Math.round((1 - clickRate) * 100) };
}

export function computeAdsPrivacyInsights(
  ads: AdsPrivacyData | null
): AdsPrivacyInsights | null {
  if (!ads) return null;

  const themedCategories: Record<AdCategoryTheme, string[]> = {
    Lifestyle: [],
    Shopping: [],
    Entertainment: [],
    Fitness: [],
    Finance: [],
    Education: [],
    Travel: [],
    Tech: [],
    Other: [],
  };

  // Interest themes come from ad categories only — advertiser names aren't interests.
  for (const cat of ads.adCategories) {
    themedCategories[themeForCategory(cat)].push(cat);
  }

  const { clickRate, resistance } = adClickStats(ads);
  const privacyCreepScore = Math.min(
    100,
    ads.advertisersCount * 2 + ads.adCategoriesCount
  );

  const creepyAdvertisers = ads.advertiserNames
    .filter((n) => n.length > 20 || /unknown|misc/i.test(n))
    .slice(0, 10);

  // Instagram doesn't rank advertisers; the export lists them alphabetically.
  const brandsStalkingYou = ads.advertiserNames.slice(0, 15);

  return {
    themedCategories,
    // The shared type is numeric; adClickStats() is the null-aware source.
    clickRate: clickRate ?? 0,
    adResistanceScore: resistance ?? 100,
    privacyCreepScore,
    creepyAdvertisers,
    brandsStalkingYou,
    summary: [
      ads.advertisersCount > 0
        ? `Instagram's export suggests these categories and ${ads.advertisersCount.toLocaleString()} advertiser${ads.advertisersCount === 1 ? "" : "s"} may have used your activity for targeting. Advertisers are listed alphabetically, not ranked.`
        : "Instagram's export suggests these categories may have been used for ad targeting.",
      resistance === null
        ? "No ad-view history was included, so ad resistance and click rate can't be measured."
        : "",
      "Availability depends on what Instagram included.",
    ]
      .filter(Boolean)
      .join(" "),
  };
}
