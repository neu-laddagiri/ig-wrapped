export type DmAiSummaryTone =
  | "wrapped"
  | "savage"
  | "real"
  | "wholesome"
  | "drama"
  | "funny";

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
  useRealNames: boolean;
  participants?: string[];
  stats: {
    totalMessages: number;
    linkCount: number;
    reelOrPostCount: number;
    mediaCount: number;
    photoCount: number;
    videoCount: number;
    audioCount: number;
    reactionCount: number;
    callCount: number;
    averageMessageLength?: number;
    firstMessageAt?: string;
    lastMessageAt?: string;
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
