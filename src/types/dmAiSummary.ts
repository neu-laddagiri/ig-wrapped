export type DmAiSummaryTone = "real" | "funny" | "savage" | "wrapped";

export interface DmAiSummaryResult {
  chatVibe: string;
  oneSentenceSummary: string;
  whoCarries: string;
  signaturePatterns: string[];
  funniestDynamic: string;
  roast: string;
  greenFlags: string[];
  redFlags: string[];
  wrappedAward: string;
  confidenceNote: string;
}

export interface DmAiSummarySaved {
  threadId: string;
  tone: DmAiSummaryTone;
  generatedAt: string;
  summary: DmAiSummaryResult;
}

export type DmAiSummariesMap = Record<string, DmAiSummarySaved>;

export interface DmSummaryApiRequest {
  threadTitle: string;
  participantCount: number;
  isGroup: boolean;
  stats: {
    totalMessages: number;
    linkCount: number;
    reelOrPostCount: number;
    mediaCount: number;
    reactionCount: number;
    callCount: number;
    mostActiveMonth?: string;
    messagesBySender: Record<string, number>;
  };
  selectedMessages: {
    sender: string;
    timestamp_ms: number;
    text: string;
  }[];
  tone: DmAiSummaryTone;
}
