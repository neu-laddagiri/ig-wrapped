import type { ParsedExportData } from "@/types/instagram";
import type { InsightsBundle, WrappedScoreboard } from "@/types/insights";

export function computeWrappedScoreboard(
  parsed: ParsedExportData,
  insights: InsightsBundle
): WrappedScoreboard {
  const { network, messages, wrapped, ads, security } = parsed;
  const mutualRatio =
    network && network.totalFollowing > 0
      ? network.mutuals.length / network.totalFollowing
      : 0;

  const social = Math.min(
    100,
    Math.round(
      (wrapped?.likedPosts ?? 0) / 20 +
        (wrapped?.postComments ?? 0) * 2 +
        (messages?.totalMessages ?? 0) / 80
    )
  );
  const networkScore = Math.min(
    100,
    Math.round(mutualRatio * 100 + (network?.mutuals.length ?? 0) / 2)
  );
  const privacy = Math.min(
    100,
    Math.round(
      100 -
        (insights.adsInsights?.privacyCreepScore ?? 30) * 0.4 -
        (ads?.adsClicked ?? 0) * 0.5
    )
  );
  const dmEnergy = Math.min(
    100,
    Math.round((messages?.totalMessages ?? 0) / 50)
  );
  const contentDiet = Math.min(
    100,
    Math.round(100 - (insights.contentDiet?.doomscrollScore ?? 40))
  );
  const securityScore = insights.securityAudit?.healthScore ?? 70;
  const cleanupAvg =
    insights.cleanup.length > 0
      ? insights.cleanup.reduce((s, c) => s + c.cleanupPriorityScore, 0) /
        insights.cleanup.length
      : 50;
  const cleanupScore = Math.min(100, Math.round(100 - cleanupAvg * 0.8));
  const completeness = insights.exportCompleteness.score;

  const entries = [
    { id: "social", label: "Social Score", score: social, maxScore: 100, confidence: "medium" as const },
    { id: "network", label: "Network Score", score: networkScore, maxScore: 100, confidence: "high" as const },
    { id: "privacy", label: "Privacy Score", score: privacy, maxScore: 100, confidence: "medium" as const },
    { id: "dm", label: "DM Energy", score: dmEnergy, maxScore: 100, confidence: "high" as const },
    { id: "content", label: "Content Diet", score: contentDiet, maxScore: 100, confidence: "medium" as const },
    { id: "security", label: "Security Score", score: securityScore, maxScore: 100, confidence: "high" as const },
    { id: "cleanup", label: "Cleanup Score", score: cleanupScore, maxScore: 100, confidence: "medium" as const },
    { id: "data", label: "Data Completeness", score: completeness, maxScore: 100, confidence: "high" as const },
  ];

  const overallHealth = Math.round(
    entries.reduce((s, e) => s + e.score, 0) / entries.length
  );

  let verdict = "Balanced Instagram energy with room to optimize.";
  if (dmEnergy > 75 && networkScore > 60)
    verdict = "DM main character with a surprisingly clean network.";
  else if (dmEnergy > 70)
    verdict = "Strong network, chaotic inbox.";
  else if (networkScore > 75 && dmEnergy < 40)
    verdict = "Low-key lurker with elite follow-back discipline.";
  else if (privacy > 75 && social < 50)
    verdict = "Socially selective, privacy-aware scroller.";
  else if (social > 70 && privacy < 50)
    verdict = "Socially active, privacy could use a tune-up.";

  if (insights.personality?.title.includes("DM Main"))
    verdict = "Socially active, privacy-aware, slightly addicted to DMs.";

  return { entries, overallHealth, verdict };
}
