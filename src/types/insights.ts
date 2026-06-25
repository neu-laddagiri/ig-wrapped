import type { LinkedInStatus } from "@/types/instagram";

export type RelationshipLabel =
  | "Mutual"
  | "You follow them, they do not follow back"
  | "They follow you, you do not follow back"
  | "DM friend"
  | "Silent mutual"
  | "Dead follow"
  | "Reels-only connection"
  | "Pending request"
  | "Blocked/restricted"
  | "Recently unfollowed"
  | "Unknown";

export type WhoFollowedFirst = "Me" | "Them" | "Same day" | "Unknown";

export type CleanupLabel =
  | "High cleanup priority"
  | "Medium cleanup priority"
  | "Low cleanup priority"
  | "Keep — you actually interact"
  | "Keep — mutual/DM active"
  | "Keep — manually marked important";

export type NameConfidence = "high" | "medium" | "low";

export interface AccountSourceBreakdown {
  directDmMessages: number;
  groupMessagesSent: number;
  groupChatsShared: number;
  isMutual: boolean;
  followsMe: boolean;
  iFollowThem: boolean;
  likedCount: number;
  commentedCount: number;
  storyInteractionCount: number;
  lastDirectDmAt?: number;
  confidence: NameConfidence;
  explanations: string[];
  isUnknownAccount: boolean;
}

export interface DmThreadDebugEntry {
  threadId: string;
  title: string;
  sourcePath?: string;
  participantCount: number;
  isGroup: boolean;
  totalMessages: number;
  senderCounts: Record<string, number>;
  inferredOtherParticipant?: string;
  contributesToDirectLeaderboard: boolean;
  contributesToGroupLeaderboard: boolean;
  nameConfidence: NameConfidence;
  isUnknownAccount: boolean;
}

export type DmMatchStatus = "matched" | "possible" | "none";
export type AttributionStatus =
  | "attributed"
  | "not_in_export"
  | "not_matched"
  | "not_account_level";

export interface UnifiedAccount {
  username: string;
  displayName: string;
  href: string;
  followsMe: boolean;
  iFollowThem: boolean;
  isMutual: boolean;
  followedMeAt?: number;
  iFollowedAt?: number;
  whoFollowedFirst: WhoFollowedFirst;
  followBackTimeMs?: number;
  firstConnectedAt?: number;
  becameMutualAt?: number;
  hasDmThread: boolean;
  dmThreadId?: string;
  dmMessageCount: number;
  /** Messages this account sent in group chats (not membership). */
  groupMessageCount: number;
  lastDmAt?: number;
  firstDmAt?: number;
  dmSentByMe?: number;
  dmSentByThem?: number;
  dmSenderSplitAvailable?: boolean;
  dmSenderSplitConfidence?: NameConfidence;
  dmMatchStatus?: DmMatchStatus;
  dmMatchMethod?: string;
  likedCount: number;
  likesAttribution?: AttributionStatus;
  commentedCount: number;
  commentsAttribution?: AttributionStatus;
  storyInteractionCount: number;
  storiesAttribution?: AttributionStatus;
  searchCount?: number;
  searchAttribution?: AttributionStatus;
  linkedInStatus?: LinkedInStatus;
  linkedInNotes?: string;
  relationshipLabel: RelationshipLabel;
  recommendedAction: string;
  isUnknownAccount?: boolean;
  nameConfidence?: NameConfidence;
  sourceBreakdown?: AccountSourceBreakdown;
  aliases?: string[];
  dataSourceNotes?: string[];
}

export interface CleanupAccount {
  username: string;
  displayName: string;
  cleanupPriorityScore: number;
  label: CleanupLabel;
  recommendedAction: string;
  iFollowThem: boolean;
  followsMe: boolean;
  dmMessageCount: number;
  isMutual: boolean;
  linkedInStatus?: LinkedInStatus;
}

export interface RealOnesAccount {
  username: string;
  displayName: string;
  realOnesScore: number;
  dmMessageCount: number;
  groupMessageCount: number;
  isMutual: boolean;
  relationshipLabel: RelationshipLabel;
  lastDmAt?: number;
  followBackTimeMs?: number;
  interactionScore: number;
  isSilentMutual: boolean;
  sourceBreakdown?: AccountSourceBreakdown;
  /** Human-readable why they ranked */
  rankReason?: string;
  /** Debug: weighted score components */
  scoreBreakdown?: string;
}

export interface DmRelationshipInsight {
  threadId: string;
  threadTitle: string;
  isGroup: boolean;
  participantCount: number;
  messageShareBySender: Record<string, number>;
  firstMessageSender?: string;
  lastMessageSender?: string;
  avgReplyTimeMs?: number;
  medianReplyTimeMs?: number;
  longestGapMs?: number;
  mostActiveHour?: number;
  mostActiveDay?: string;
  lateNightCount: number;
  mostActiveMonth?: string;
}

export interface DmAward {
  id: string;
  title: string;
  threadId: string;
  threadLabel: string;
  description: string;
}

export interface GroupChatRole {
  participant: string;
  role: string;
  messageCount: number;
  messageShare: number;
}

export interface GroupChatInsight {
  threadId: string;
  title: string;
  participantCount: number;
  totalMessages: number;
  topSender?: string;
  leastActive?: string;
  messageShare: Record<string, number>;
  reelsShared: number;
  mediaCount: number;
  mostActiveMonth?: string;
  lastActiveAt?: number;
  lateNightCount: number;
  roles: GroupChatRole[];
}

export interface EraBreakdownLine {
  label: string;
  count: number;
}

export interface EraLabel {
  month: string;
  monthLabel?: string;
  label: string;
  caption: string;
  /** e.g. "Dominated by story views and DMs." */
  dominanceLine?: string;
  count: number;
  topActivityType?: string;
  topActivityCount?: number;
  breakdown?: EraBreakdownLine[];
  confidence?: "high" | "medium";
}

export interface ErasTimeline {
  version?: number;
  monthlyTotals: { month: string; label: string; count: number }[];
  topMonths: { month: string; label: string; count: number }[];
  peakMonth?: { month: string; label: string; count: number };
  eraLabels: EraLabel[];
  trend: "rising" | "falling" | "stable" | "unknown";
}

export interface ContentDietResult {
  passiveCount: number;
  activeCount: number;
  passiveRatio: number;
  likingVsLurkingRatio: number;
  saveRate: number;
  commentRate: number;
  storyViewerScore: number;
  doomscrollScore: number;
  adClickResistance: number;
  personality: string;
  caption: string;
  metrics: { label: string; value: string }[];
}

export interface AccountLeaderboardEntry {
  username: string;
  displayName: string;
  score: number;
  dmCount: number;
  groupDmCount?: number;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  storyCount: number;
  sourceBreakdown?: AccountSourceBreakdown;
}

export interface AccountLeaderboard {
  id: string;
  title: string;
  entries: AccountLeaderboardEntry[];
  emptyReason?: string;
  sourceNote?: string;
}

export type AdCategoryTheme =
  | "Lifestyle"
  | "Shopping"
  | "Entertainment"
  | "Fitness"
  | "Finance"
  | "Education"
  | "Travel"
  | "Tech"
  | "Other";

export interface AdsPrivacyInsights {
  themedCategories: Record<AdCategoryTheme, string[]>;
  clickRate: number;
  adResistanceScore: number;
  privacyCreepScore: number;
  creepyAdvertisers: string[];
  brandsStalkingYou: string[];
  summary: string;
}

export interface ConnectedApp {
  name: string;
  addedAt?: number;
  lastUsedAt?: number;
  isStale: boolean;
}

export interface SecurityAuditResult {
  healthScore: number;
  connectedApps: ConnectedApp[];
  staleApps: ConnectedApp[];
  suggestions: string[];
  loginTimelineCount: number;
  passwordChangeCount: number;
  privacyChangeCount: number;
}

export interface SearchWrappedEntry {
  query: string;
  count: number;
  lastSearchedAt?: number;
  type: "account" | "term" | "unknown";
}

export interface SearchWrappedResult {
  totalSearches: number;
  topAccounts: SearchWrappedEntry[];
  topTerms: SearchWrappedEntry[];
  repeatedSearches: SearchWrappedEntry[];
  labels: string[];
  privacyNote: string;
  filesParsed?: string[];
  searchTimeline?: { month: string; count: number }[];
}

export interface PersonalityResult {
  title: string;
  description: string;
  reasons: string[];
  stats: { label: string; value: string }[];
}

export interface ShareCardData {
  id: string;
  title: string;
  lines: string[];
  hideNames: boolean;
  /** Thread or person names that may be redacted when hideNames is true */
  sensitiveLines?: string[];
}

export interface ExportCompletenessResult {
  score: number;
  detectedCount: number;
  totalCategories: number;
  missing: string[];
  recommendations: string[];
  categoryStatus: { id: string; label: string; detected: boolean }[];
}

export interface DataExplorerFile {
  path: string;
  category: string;
  folder: string;
  contributed: boolean;
  feature?: string;
}

export interface IdentityMatchDebugRow {
  resolvedName: string;
  username?: string;
  messageCount: number;
  matchMethod: string;
  confidence: NameConfidence;
  threadTitle?: string;
}

export interface UnmatchedDmThreadRow {
  threadId: string;
  title: string;
  messageCount: number;
  participants: string[];
  folderSlug?: string;
}

export interface IdentityResolutionDebug {
  totalCanonicalPeople: number;
  networkOnlyPeople: number;
  directDmMatchedPeople: number;
  possibleDmMatches: number;
  unmatchedDmThreads: number;
  topMatches: IdentityMatchDebugRow[];
  topUnmatched: UnmatchedDmThreadRow[];
}

export interface DataExplorerMeta {
  files: DataExplorerFile[];
  jsonCount: number;
  mediaCount: number;
  totalCount: number;
  leaderboardSources?: Record<string, string>;
  dmThreadDebug?: DmThreadDebugEntry[];
  identityResolution?: IdentityResolutionDebug;
  coreAnalytics?: {
    directDmThreadCount: number;
    groupDmThreadCount: number;
    topDirectDmThreads: {
      rank: number;
      name: string;
      messageCount: number;
      threadTitle?: string;
    }[];
    topDmPeople: {
      rank: number;
      name: string;
      username?: string;
      messageCount: number;
      matchMethod?: string;
    }[];
    topLinkedInMostInteracted: {
      name: string;
      username: string;
      score: number;
      breakdown: string;
    }[];
    topRealOnes: {
      name: string;
      username: string;
      score: number;
      breakdown: string;
    }[];
    validation?: {
      dmLeaderboardParityOk: boolean;
      dmLeaderboardParityNotes: string[];
      blockedIncluded: boolean;
      restrictedIncluded: boolean;
      ownerIdentityConfidence: string;
      ownerIdentityUsernames?: string[];
      ownerIdentityDisplayNames?: string[];
      ownerIdentitySources?: string[];
      interactionExportMeta?: {
        likesFilePresent: boolean;
        commentsFilePresent: boolean;
        storiesFilePresent: boolean;
        hasAccountLevelLikes: boolean;
        hasAccountLevelComments: boolean;
        hasAccountLevelStories: boolean;
      };
    };
  };
}

export type ConfidenceLevel = "high" | "medium" | "low";

export interface DmHeatmapCell {
  day: number;
  hour: number;
  count: number;
}

export interface DmHeatmapResult {
  cells: DmHeatmapCell[];
  mostActiveDay: string;
  mostActiveHour: string;
  peakWeek?: string;
  lateNightStreak: number;
  longestDroughtDays: number;
  totalTimestamped: number;
  available: boolean;
}

export interface ThreadReplyPattern {
  threadId: string;
  threadName: string;
  partnerLabel: string;
  avgReplyMsYou?: number;
  avgReplyMsThem?: number;
  medianReplyMsYou?: number;
  medianReplyMsThem?: number;
  longestGhostGapDays: number;
  conversationStartsYou: number;
  conversationStartsThem: number;
  lastMessagesYou: number;
  lastMessagesThem: number;
  responseBalanceScore: number;
  messageCount: number;
}

export interface ReplyPatternResult {
  threads: ThreadReplyPattern[];
  fastestResponder?: { label: string; avgMs: number };
  slowestResponder?: { label: string; avgMs: number };
  longestGhostGap?: { label: string; days: number };
  topStarter?: { label: string; count: number };
  topEnder?: { label: string; count: number };
  available: boolean;
}

export interface NetworkCluster {
  id: string;
  title: string;
  description: string;
  count: number;
  usernames: string[];
  confidence: ConfidenceLevel;
}

export interface ScoreboardEntry {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  confidence: ConfidenceLevel;
}

export interface WrappedScoreboard {
  entries: ScoreboardEntry[];
  overallHealth: number;
  verdict: string;
}

export interface AccountFlag {
  id: string;
  label: string;
  tone: "green" | "red";
}

export interface HallOfFameAward {
  id: string;
  title: string;
  winnerLabel: string;
  winnerUsername?: string;
  why: string;
  confidence: ConfidenceLevel;
  category: "fame" | "shame";
}

export interface YearbookCard {
  id: string;
  superlative: string;
  winnerLabel: string;
  winnerUsername?: string;
  caption: string;
  category: YearbookCategory;
  confidence?: ConfidenceLevel;
  icon?: string;
}

export type YearbookCategory =
  | "DMs"
  | "Network"
  | "Privacy"
  | "Ads"
  | "Search"
  | "Groups";

export interface AdRoastResult {
  personality: string;
  fbiNotes: string;
  identityCrisisScore: number;
  topAdvertiser: string;
  brandsStalkingYou: string[];
  roastLine: string;
  confidence: ConfidenceLevel;
  themedCategories: AdsPrivacyInsights["themedCategories"];
}

export interface SocialAuditItem {
  id: string;
  label: string;
  tone: "green" | "red";
  explanation: string;
  confidence: ConfidenceLevel;
}

export interface BurnoutMeterResult {
  confidence: ConfidenceLevel;
  disclaimer: string;
  mostActiveHour?: number;
  mostActiveDay?: string;
  peakDoomscrollMonth?: string;
  lateNightScore: number;
  passiveScrollingRatio: number;
  touchGrassScore: number;
  socialBatteryDrain: number;
  secondHomeMonth?: string;
  weekendVsWeekday: "weekend" | "weekday" | "balanced";
  nightOwlScore: number;
  metrics: { label: string; value: string }[];
}

export interface InsightsBundle {
  version: number;
  accounts: UnifiedAccount[];
  /** Canonical DM receipt slices keyed by network username — same source as DMs tab. */
  dmReceiptByUsername?: import("@/lib/accountReceipt").DmReceiptByUsername;
  /** Canonical account records — DM stats match DMs tab. */
  canonicalAccounts?: import("@/lib/canonicalAccounts").CanonicalAccount[];
  cleanup: CleanupAccount[];
  realOnes: RealOnesAccount[];
  silentMutuals: RealOnesAccount[];
  dmRelationshipInsights: DmRelationshipInsight[];
  dmAwards: DmAward[];
  groupChats: GroupChatInsight[];
  eras: ErasTimeline | null;
  contentDiet: ContentDietResult | null;
  leaderboards: AccountLeaderboard[];
  adsInsights: AdsPrivacyInsights | null;
  securityAudit: SecurityAuditResult | null;
  searchWrapped: SearchWrappedResult | null;
  personality: PersonalityResult | null;
  shareCards: ShareCardData[];
  exportCompleteness: ExportCompletenessResult;
  dataExplorer: DataExplorerMeta;
  dmHeatmap?: DmHeatmapResult | null;
  replyPatterns?: ReplyPatternResult | null;
  networkClusters?: NetworkCluster[];
  wrappedScoreboard?: WrappedScoreboard | null;
  hallOfFame?: HallOfFameAward[];
  yearbook?: YearbookCard[];
  adRoast?: AdRoastResult | null;
  burnoutMeter?: BurnoutMeterResult | null;
  socialAudit?: SocialAuditItem[];
}
