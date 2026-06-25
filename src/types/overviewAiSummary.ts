export type OverviewAiTone = "wrapped" | "real" | "savage" | "drama";

export interface OverviewAiSummaryResult {
  overallVibe: string;
  whatInstagramSays: string;
  strongestPattern: string;
  funniestCallout: string;
  privacyRecommendation: string;
  wrappedAward: string;
  tone: OverviewAiTone;
  generatedAt: string;
}

export interface OverviewAiSummaryRequest {
  tone: OverviewAiTone;
  metrics: Record<string, string | number | null>;
}
