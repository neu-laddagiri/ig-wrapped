import type { ParsedExportData } from "@/types/instagram";
import type {
  ConfidenceLevel,
  InsightsBundle,
  ScoreboardEntry,
  WrappedScoreboard,
} from "@/types/insights";

/**
 * `available: false` means the export lacks this entry's inputs; `score` is then
 * a 0 placeholder that must be shown as "—" and is left out of the overall score.
 */
export interface ScoreboardEntryWithAvailability extends ScoreboardEntry {
  available?: boolean;
}

export function isScoreboardEntryAvailable(entry: ScoreboardEntry): boolean {
  return (entry as ScoreboardEntryWithAvailability).available !== false;
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, Math.min(100, n)));
}

function entry(
  id: string,
  label: string,
  score: number | null,
  confidence: ConfidenceLevel
): ScoreboardEntryWithAvailability {
  if (score === null) {
    return { id, label, score: 0, maxScore: 100, confidence: "low", available: false };
  }
  return { id, label, score: clampScore(score), maxScore: 100, confidence, available: true };
}

export function computeWrappedScoreboard(
  parsed: ParsedExportData,
  insights: InsightsBundle
): WrappedScoreboard {
  const { network, messages, wrapped, ads, security } = parsed;
  const mutualRatio =
    network && network.totalFollowing > 0
      ? network.mutuals.length / network.totalFollowing
      : null;

  const social =
    wrapped || messages
      ? (wrapped?.likedPosts ?? 0) / 20 +
        (wrapped?.postComments ?? 0) * 2 +
        (messages?.totalMessages ?? 0) / 80
      : null;
  const networkScore =
    network && mutualRatio !== null
      ? mutualRatio * 100 + network.mutuals.length / 2
      : null;
  // Click penalty is capped so heavy clickers bottom out instead of going negative.
  const privacy =
    ads && insights.adsInsights
      ? 100 -
        insights.adsInsights.privacyCreepScore * 0.4 -
        Math.min(40, ads.adsClicked * 0.5)
      : null;
  const dmEnergy = messages ? messages.totalMessages / 50 : null;
  const contentDiet = insights.contentDiet
    ? 100 - insights.contentDiet.doomscrollScore
    : null;
  const securityScore = insights.securityAudit?.healthScore ?? null;
  const cleanupScore =
    insights.cleanup.length > 0
      ? 100 -
        (insights.cleanup.reduce((s, c) => s + c.cleanupPriorityScore, 0) /
          insights.cleanup.length) *
          0.8
      : null;
  const completeness = insights.exportCompleteness.score;

  const entries = [
    entry("social", "Social Score", social, wrapped && messages ? "medium" : "low"),
    entry("network", "Network Score", networkScore, "high"),
    entry("privacy", "Privacy Score", privacy, "medium"),
    entry("dm", "DM Energy", dmEnergy, "high"),
    entry("content", "Content Diet", contentDiet, "medium"),
    entry("security", "Security Score", securityScore, security ? "high" : "medium"),
    entry("cleanup", "Cleanup Score", cleanupScore, "medium"),
    entry("data", "Data Completeness", completeness, "high"),
  ];

  const available = entries.filter((e) => e.available);
  const overallHealth = available.length
    ? Math.round(available.reduce((s, e) => s + e.score, 0) / available.length)
    : 0;

  const scoreOf = (id: string): number | null => {
    const found = entries.find((e) => e.id === id);
    return found?.available ? found.score : null;
  };
  const dm = scoreOf("dm");
  const net = scoreOf("network");
  const priv = scoreOf("privacy");
  const soc = scoreOf("social");

  let verdict = "Balanced Instagram energy with room to optimize.";
  if (dm !== null && dm > 75 && net !== null && net > 60)
    verdict = "DM main character with a surprisingly clean network.";
  else if (dm !== null && dm > 70)
    verdict = "Chaotic inbox — your DMs do the heavy lifting.";
  else if (mutualRatio !== null && mutualRatio > 0.75 && (dm === null || dm < 40))
    verdict = "Low-key lurker with elite follow-back discipline.";
  else if (priv !== null && priv > 75 && soc !== null && soc < 50)
    verdict = "Socially selective, privacy-aware scroller.";
  else if (soc !== null && soc > 70 && priv !== null && priv < 50)
    verdict = "Socially active, privacy could use a tune-up.";

  if (insights.personality?.title.includes("DM Main")) {
    verdict =
      priv !== null && priv > 60
        ? "Socially active, privacy-aware, slightly addicted to DMs."
        : "Socially active and slightly addicted to DMs.";
  }

  return { entries, overallHealth, verdict };
}
