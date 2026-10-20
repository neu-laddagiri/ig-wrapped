import type { AdsPrivacyData } from "@/types/instagram";
import type { AdsPrivacyInsights, AdRoastResult } from "@/types/insights";

export function computeAdRoast(
  ads: AdsPrivacyData | null,
  adsInsights: AdsPrivacyInsights | null
): AdRoastResult | null {
  if (!ads || !adsInsights) return null;

  // "Other" is a catch-all bucket, not an interest.
  const topThemes = Object.entries(adsInsights.themedCategories)
    .filter(([theme, cats]) => theme !== "Other" && cats.length > 0)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([theme]) => theme);

  const identityCrisis = Math.min(
    100,
    ads.adCategoriesCount * 2 + ads.advertisersCount
  );

  const personality =
    topThemes.length > 0
      ? `Instagram's ad categories suggest you're into ${topThemes.join(", ").toLowerCase()}.`
      : ads.adCategoriesCount > 0
        ? "Instagram's ad categories for you don't fit the usual themes."
        : "Instagram's ad profile is vague in this export.";

  const fbiNotes =
    ads.adCategoriesCount > 15
      ? "Detailed category list — your export suggests heavy ad profiling."
      : ads.adCategoriesCount > 0
        ? "Some ad categories detected. Mild profiling vibes."
        : "Limited ad category data in this download.";

  let roastLine: string;
  if (identityCrisis > 60) {
    roastLine = "Your ad profile has more plot twists than your feed.";
  } else if (identityCrisis > 30) {
    roastLine = "Instagram has opinions about you — mostly from advertisers.";
  } else if (ads.adsViewed >= 200) {
    roastLine = "A small ad profile — but you still saw plenty of ads.";
  } else if (ads.adsViewed > 0) {
    roastLine = "Relatively low ad exposure in this export. Touch grass approved.";
  } else {
    roastLine = "A light ad profile, and no ad-view history in this export.";
  }

  return {
    personality,
    fbiNotes,
    identityCrisisScore: identityCrisis,
    // Advertisers are listed alphabetically in the export, so none is "top".
    topAdvertiser: "—",
    brandsStalkingYou: adsInsights.brandsStalkingYou.slice(0, 8),
    roastLine,
    confidence: ads.adCategoriesCount > 0 ? "medium" : "low",
    themedCategories: adsInsights.themedCategories,
  };
}
