import type { CoverageCategoryId, DataCoverageItem } from "@/types/instagram";
import type { ExportCompletenessResult } from "@/types/insights";

export function computeExportCompleteness(
  coverage: DataCoverageItem[],
  extras?: { hasSearch?: boolean; hasApps?: boolean }
): ExportCompletenessResult {
  const categoryStatus: { id: CoverageCategoryId; label: string; detected: boolean }[] =
    coverage.map((c) => ({
      id: c.id,
      label: c.label,
      detected: c.detected,
    }));

  if (extras?.hasSearch) {
    categoryStatus.push({
      id: "search_history",
      label: "Search history",
      detected: true,
    });
  }
  if (extras?.hasApps) {
    categoryStatus.push({
      id: "connected_apps",
      label: "Connected apps",
      detected: true,
    });
  }

  const detectedCount = categoryStatus.filter((c) => c.detected).length;
  const totalCategories = categoryStatus.length;
  const score = Math.round((detectedCount / Math.max(totalCategories, 1)) * 100);

  const missing = categoryStatus
    .filter((c) => !c.detected)
    .map((c) => c.label);

  const recommendations = [
    "For best results, choose All available information when exporting.",
    "Use JSON format for full analytics support.",
    "Choose All time for complete history.",
    "Media quality does not affect most analytics.",
  ];

  if (missing.includes("Messages")) {
    recommendations.unshift("Include messages for DM analytics and AI summaries.");
  }

  return {
    score,
    detectedCount,
    totalCategories,
    missing,
    recommendations,
    categoryStatus,
  };
}
