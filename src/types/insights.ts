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
  likedCount: number;
  commentedCount: number;
  storyInteractionCount: number;
  linkedInStatus?: LinkedInStatus;
  linkedInNotes?: string;
  relationshipLabel: RelationshipLabel;
  recommendedAction: string;
  isUnknownAccount?: boolean;
  nameConfidence?: NameConfidence;
  sourceBreakdown?: AccountSourceBreakdown;
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

export interface EraLabel {
  month: string;
  label: string;
  caption: string;
  count: number;
  topActivityType?: string;
}

export interface ErasTimeline {
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

export interface DataExplorerMeta {
  files: DataExplorerFile[];
  jsonCount: number;
  mediaCount: number;
  totalCount: number;
  leaderboardSources?: Record<string, string>;
  dmThreadDebug?: DmThreadDebugEntry[];
}

export interface InsightsBundle {
  version: number;
  accounts: UnifiedAccount[];
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
}
