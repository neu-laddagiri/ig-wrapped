import type { AdsPrivacyData } from "@/types/instagram";
import type { AdsPrivacyInsights, AdRoastResult } from "@/types/insights";

export function computeAdRoast(
  ads: AdsPrivacyData | null,
  adsInsights: AdsPrivacyInsights | null
): AdRoastResult | null {
  if (!ads || !adsInsights) return null;

  const topThemes = Object.entries(adsInsights.themedCategories)
    .filter(([, cats]) => cats.length > 0)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([theme]) => theme);

  const identityCrisis = Math.min(
    100,
    ads.adCategoriesCount * 2 + ads.advertisersCount
  );

  const creepy = adsInsights.creepyAdvertisers[0] ?? ads.advertiserNames[0];
  const personality =
    topThemes.length > 0
      ? `Instagram thinks you're into ${topThemes.join(", ").toLowerCase()}.`
      : "Instagram's ad profile is vague in this export.";

  const fbiNotes =
    ads.adCategoriesCount > 15
      ? "Detailed category list — your export suggests heavy ad profiling."
      : ads.adCategoriesCount > 0
        ? "Some ad categories detected. Mild profiling vibes."
        : "Limited ad category data in this download.";

  return {
    personality,
    fbiNotes,
    identityCrisisScore: identityCrisis,
    topAdvertiser: creepy ?? "—",
    brandsStalkingYou: adsInsights.brandsStalkingYou.slice(0, 8),
    roastLine:
      identityCrisis > 60
        ? "Your ad profile has more plot twists than your feed."
        : identityCrisis > 30
          ? "Instagram has opinions about you — mostly from advertisers."
          : "Relatively low ad exposure in this export. Touch grass approved.",
    confidence: ads.adCategoriesCount > 0 ? "medium" : "low",
    themedCategories: adsInsights.themedCategories,
  };
}
