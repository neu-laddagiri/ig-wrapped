export interface InstagramAccount {
  username: string;
  displayUsername: string;
  href?: string;
  timestamp?: number;
  category?: string;
}

export interface NetworkStats {
  totalFollowers: number;
  totalFollowing: number;
  mutuals: InstagramAccount[];
  dontFollowMeBack: InstagramAccount[];
  iDontFollowBack: InstagramAccount[];
  followBackRatio: number;
  pendingRequests: InstagramAccount[];
  recentFollowRequests: InstagramAccount[];
  recentlyUnfollowed: InstagramAccount[];
  blocked: InstagramAccount[];
  restricted: InstagramAccount[];
  followers: InstagramAccount[];
  following: InstagramAccount[];
}

export interface WrappedInsights {
  likedPosts: number;
  likedComments: number;
  postComments: number;
  savedPosts: number;
  storiesViewed: number;
  storyLikes: number;
  pollInteractions: number;
  emojiSliderInteractions: number;
  quizzes: number;
  videosWatched: number;
  postsViewed: number;
}

export interface DmThreadAnalytics {
  id: string;
  threadName: string;
  title?: string;
  threadPath?: string;
  sourcePath?: string;
  participants: string[];
  participantCount: number;
  isGroupChat: boolean;
  messageCount: number;
  folder: "inbox" | "message_requests" | "other";
  messagesBySender: Record<string, number>;
  firstMessageTimestamp?: number;
  lastMessageTimestamp?: number;
  firstMessageSender?: string;
  lastMessageSender?: string;
  /** Stored for local preview only — stripped from cloud save by default */
  firstMessagePreview?: string;
  mostActiveMonth?: string;
  messagesByMonth: { month: string; count: number }[];
  avgMessageLength?: number;
  emojiCount: number;
  linkCount: number;
  instagramReelLinks: number;
  instagramPostLinks: number;
  instagramStoryLinks: number;
  estimatedInstagramLinks: number;
  reelOrPostCount?: number;
  sharedMediaCount: number;
  photoCount: number;
  videoCount: number;
  audioCount: number;
  reactionCount: number;
  callEventCount: number;
  callCount?: number;
  reelsLinksBySender: Record<string, number>;
  postLinksBySender: Record<string, number>;
  funSummary: string;
}

export interface DmAnalytics {
  dmParserVersion?: number;
  totalThreads: number;
  inboxThreads: number;
  messageRequestThreads: number;
  groupChatCount: number;
  oneOnOneCount: number;
  totalMessages: number;
  messagesByMonth: { month: string; count: number }[];
  threads: DmThreadAnalytics[];
  topThreads: DmThreadAnalytics[];
}

/** @deprecated Use DmThreadAnalytics */
export type DmThreadSummary = DmThreadAnalytics;

export interface AdsPrivacyData {
  adsViewed: number;
  adsClicked: number;
  videosWatched: number;
  postsViewed: number;
  advertisersCount: number;
  adCategoriesCount: number;
  advertiserNames: string[];
  adCategories: string[];
}

export interface SecurityData {
  loginCount: number;
  logoutCount: number;
  profileActivityCount: number;
  privacyChangeCount: number;
  passwordChangeCount: number;
}

export type CoverageCategoryId =
  | "followers_following"
  | "likes"
  | "comments"
  | "saved"
  | "story_interactions"
  | "posts_viewed"
  | "videos_watched"
  | "ads"
  | "advertisers"
  | "messages"
  | "login_activity"
  | "profile_activity"
  | "security_changes"
  | "personal_information"
  | "media_files";

export interface DataCoverageItem {
  id: CoverageCategoryId;
  label: string;
  description: string;
  detected: boolean;
  fileCount: number;
}

export interface ParsedExportData {
  network: NetworkStats | null;
  wrapped: WrappedInsights | null;
  messages: DmAnalytics | null;
  ads: AdsPrivacyData | null;
  security: SecurityData | null;
  coverage: DataCoverageItem[];
  totalFiles: number;
  jsonFiles: number;
  mediaFiles: number;
  filePaths: string[];
  errors: string[];
}

export type LinkedInStatus =
  | "not-reviewed"
  | "found"
  | "request-sent"
  | "connected"
  | "skip"
  | "not-found";

export type LinkedInSource =
  | "all"
  | "mutuals"
  | "followers"
  | "following"
  | "dontFollowMeBack"
  | "iDontFollowBack";

export interface LinkedInHelperEntry {
  username: string;
  displayUsername: string;
  instagramHref?: string;
  status: LinkedInStatus;
  notes: string;
  category?: string;
}

export interface AccountNetworkDetail {
  username: string;
  displayUsername: string;
  href?: string;
  followsMe: boolean;
  iFollowThem: boolean;
  isMutual: boolean;
  followedMeAt?: number;
  iFollowedAt?: number;
  firstConnectedAt?: number;
  becameMutualAt?: number;
  isPending: boolean;
  isRecentRequest: boolean;
  isRecentlyUnfollowed: boolean;
  isBlocked: boolean;
  isRestricted: boolean;
  categories: string[];
}

export type NetworkListKey =
  | "dontFollowMeBack"
  | "iDontFollowBack"
  | "mutuals"
  | "followers"
  | "following"
  | "pendingRequests"
  | "recentFollowRequests"
  | "recentlyUnfollowed"
  | "blocked"
  | "restricted";

export type SortField = "username" | "timestamp";
export type SortDirection = "asc" | "desc";

export const PAGE_SIZE_OPTIONS = [25, 50, 100, 250] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
