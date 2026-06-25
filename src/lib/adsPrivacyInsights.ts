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

  for (const cat of ads.adCategories) {
    themedCategories[themeForCategory(cat)].push(cat);
  }
  for (const cat of ads.advertiserNames.slice(0, 5)) {
    themedCategories[themeForCategory(cat)].push(cat);
  }

  const clickRate =
    ads.adsViewed > 0 ? ads.adsClicked / ads.adsViewed : 0;
  const adResistanceScore = Math.round((1 - clickRate) * 100);
  const privacyCreepScore = Math.min(
    100,
    ads.advertisersCount * 2 + ads.adCategoriesCount
  );

  const creepyAdvertisers = ads.advertiserNames
    .filter((n) => n.length > 20 || /unknown|misc/i.test(n))
    .slice(0, 10);

  const brandsStalkingYou = ads.advertiserNames.slice(0, 15);

  return {
    themedCategories,
    clickRate,
    adResistanceScore,
    privacyCreepScore,
    creepyAdvertisers,
    brandsStalkingYou,
    summary:
      "Instagram's export suggests these categories and advertisers may have used your activity for targeting. Availability depends on what Instagram included.",
  };
}
