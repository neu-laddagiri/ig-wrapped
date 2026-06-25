import type { InsightsBundle, SocialAuditItem } from "@/types/insights";
import type { ParsedExportData } from "@/types/instagram";

export function computeSocialAudit(
  parsed: ParsedExportData,
  bundle: InsightsBundle
): SocialAuditItem[] {
  const items: SocialAuditItem[] = [];
  const network = parsed.network;
  const ads = parsed.ads;

  if (network && network.followBackRatio > 0.45) {
    items.push({
      id: "strong-mutual",
      label: "Strong mutual ratio",
      tone: "green",
      explanation: `${Math.round(network.followBackRatio * 100)}% follow-back — solid reciprocity.`,
      confidence: "high",
    });
  }

  if (network && network.dontFollowMeBack.length > network.mutuals.length) {
    items.push({
      id: "one-way-follows",
      label: "Lots of one-way follows",
      tone: "red",
      explanation: `${network.dontFollowMeBack.length} don't follow you back.`,
      confidence: "high",
    });
  }

  if (bundle.silentMutuals.length > 10) {
    items.push({
      id: "silent-mutuals",
      label: "Silent mutual zone",
      tone: "red",
      explanation: `${bundle.silentMutuals.length}+ mutuals with little interaction.`,
      confidence: "medium",
    });
  }

  if (bundle.burnoutMeter && bundle.burnoutMeter.lateNightScore > 25) {
    items.push({
      id: "late-night",
      label: "Heavy late-night usage",
      tone: "red",
      explanation: `${bundle.burnoutMeter.lateNightScore}% of sampled DMs were late night.`,
      confidence: bundle.burnoutMeter.confidence,
    });
  }

  if (bundle.contentDiet && bundle.contentDiet.passiveRatio > 0.7) {
    items.push({
      id: "passive-scroll",
      label: "Passive scrolling heavy",
      tone: "red",
      explanation: "Mostly viewing vs active engagement in activity export.",
      confidence: "medium",
    });
  }

  if (ads && ads.adsClicked === 0 && ads.adsViewed > 30) {
    items.push({
      id: "ad-resistant",
      label: "Low ad click rate",
      tone: "green",
      explanation: "Rarely clicks ads despite views.",
      confidence: "medium",
    });
  }

  if (parsed.ads && parsed.ads.adCategoriesCount > 20) {
    items.push({
      id: "ad-profile",
      label: "Detailed ad profile",
      tone: "red",
      explanation: `${parsed.ads.adCategoriesCount} ad categories in export.`,
      confidence: "medium",
    });
  }

  const balanced = bundle.dmAwards.find((a) => a.id === "balanced");
  if (balanced) {
    items.push({
      id: "balanced-dm",
      label: "Balanced conversations exist",
      tone: "green",
      explanation: "At least one thread with even message split.",
      confidence: "high",
    });
  }

  if (
    parsed.security?.suspiciousLoginAnalysis?.flaggedEvents?.length
  ) {
    const count = parsed.security.suspiciousLoginAnalysis.flaggedEvents.length;
    items.push({
      id: "security-review",
      label: "Security events worth reviewing",
      tone: "red",
      explanation: `${count} flagged items in export.`,
      confidence: "medium",
    });
  }

  const highCleanup = bundle.cleanup.filter((c) => c.cleanupPriorityScore >= 60).length;
  if (highCleanup > 5) {
    items.push({
      id: "cleanup-needed",
      label: "Cleanup list is loaded",
      tone: "red",
      explanation: `${highCleanup} high-priority cleanup candidates.`,
      confidence: "medium",
    });
  } else if (highCleanup === 0 && network) {
    items.push({
      id: "clean-network",
      label: "Tidy follow graph",
      tone: "green",
      explanation: "Few high-priority cleanup candidates.",
      confidence: "medium",
    });
  }

  return items;
}
