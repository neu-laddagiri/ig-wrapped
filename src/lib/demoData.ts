import type {
  AdsPrivacyData,
  DataCoverageItem,
  DmAnalytics,
  DmMessageSample,
  DmThreadAnalytics,
  InstagramAccount,
  MostActiveEraData,
  NetworkStats,
  ParsedExportData,
  SecurityData,
  WrappedInsights,
} from "@/types/instagram";
import { computeInsightsBundle } from "@/lib/insightsEngine";
import { enrichInsightsBundle } from "@/lib/advancedInsights";

const DEMO_NAMES = [
  "Alex Rivera",
  "Jordan Chen",
  "Sam Okonkwo",
  "Taylor Brooks",
  "Morgan Lee",
  "Casey Kim",
  "Riley Patel",
  "Quinn Martinez",
  "Avery Johnson",
  "Drew Williams",
  "Jamie Foster",
  "Skyler Nguyen",
  "Reese Thompson",
  "Blake Anderson",
  "Cameron Diaz",
];

function demoUser(i: number): InstagramAccount {
  const name = DEMO_NAMES[i % DEMO_NAMES.length];
  const slug = name.toLowerCase().replace(/\s+/g, "_") + "_demo";
  const ts = Date.now() - (i + 1) * 86400000 * 14;
  return {
    username: slug,
    displayUsername: slug,
    href: `https://www.instagram.com/${slug}/`,
    timestamp: ts,
  };
}

function buildNetwork(): NetworkStats {
  const followers = Array.from({ length: 48 }, (_, i) => demoUser(i));
  const following = Array.from({ length: 72 }, (_, i) => demoUser(i + 5));
  const mutualUsernames = new Set(
    following.slice(0, 34).map((a) => a.username)
  );
  const mutuals = followers.filter((f) => mutualUsernames.has(f.username));
  const dontFollowMeBack = following.filter(
    (f) => !followers.some((x) => x.username === f.username)
  );
  const iDontFollowBack = followers.filter(
    (f) => !following.some((x) => x.username === f.username)
  );
  const followBackRatio =
    following.length > 0 ? mutuals.length / following.length : 0;

  return {
    totalFollowers: followers.length,
    totalFollowing: following.length,
    mutuals,
    dontFollowMeBack,
    iDontFollowBack,
    followBackRatio,
    pendingRequests: [demoUser(40)],
    recentFollowRequests: [demoUser(41), demoUser(42)],
    recentlyUnfollowed: [demoUser(43)],
    blocked: [],
    restricted: [],
    followers,
    following,
  };
}

function buildMessages(): DmAnalytics {
  const now = Date.now();
  const day = 86400000;

  function thread(
    id: string,
    name: string,
    partner: string,
    msgCount: number,
    isGroup: boolean,
    participants: string[]
  ): DmThreadAnalytics {
    const messagesBySender: Record<string, number> = {};
    if (isGroup) {
      participants.forEach((p, i) => {
        messagesBySender[p] = Math.floor(msgCount / participants.length) + i * 3;
      });
    } else {
      messagesBySender["You"] = Math.floor(msgCount * 0.52);
      messagesBySender[partner] = msgCount - messagesBySender["You"];
    }

    const textMessages: DmMessageSample[] = [];
    if (!isGroup) {
      let t = now - day * 30;
      let sender = partner;
      for (let i = 0; i < Math.min(40, msgCount); i++) {
        textMessages.push({
          sender_name: sender,
          timestamp_ms: t,
          content: `Demo message ${i + 1}`,
        });
        sender = sender === "You" ? partner : "You";
        t += (i % 3 === 0 ? 120000 : 3600000) + Math.random() * 600000;
      }
    }

    const months = ["2025-09", "2025-10", "2025-11", "2025-12", "2026-01"];
    return {
      id,
      threadName: name,
      participants: isGroup ? participants : [partner, "You"],
      participantCount: isGroup ? participants.length : 2,
      isGroupChat: isGroup,
      messageCount: msgCount,
      folder: "inbox",
      messagesBySender,
      firstMessageTimestamp: now - day * 90,
      lastMessageTimestamp: now - day * 2,
      firstMessageSender: partner,
      lastMessageSender: "You",
      firstMessagePreview: "Hey! demo chat preview.",
      mostActiveMonth: "2025-11",
      messagesByMonth: months.map((month, i) => ({
        month,
        count: Math.floor(msgCount / 5) + i * 12,
      })),
      avgMessageLength: 42,
      emojiCount: 28,
      linkCount: 6,
      instagramReelLinks: 4,
      instagramPostLinks: 2,
      instagramStoryLinks: 1,
      estimatedInstagramLinks: 7,
      reelOrPostCount: 6,
      sharedMediaCount: 3,
      photoCount: 2,
      videoCount: 1,
      audioCount: 0,
      reactionCount: 5,
      callEventCount: 0,
      callCount: 0,
      reelsLinksBySender: { [partner]: 3 },
      postLinksBySender: { You: 2 },
      funSummary: isGroup
        ? "Group chat energy with steady meme traffic."
        : "Balanced back-and-forth with reel links.",
      textMessages,
    };
  }

  const t1 = thread(
    "demo-t1",
    "Alex Rivera",
    "Alex Rivera",
    842,
    false,
    []
  );
  const t2 = thread(
    "demo-t2",
    "Jordan Chen",
    "Jordan Chen",
    521,
    false,
    []
  );
  const t3 = thread(
    "demo-t3",
    "Weekend Crew",
    "Group",
    1204,
    true,
    ["You", "Sam Okonkwo", "Taylor Brooks", "Morgan Lee", "Casey Kim"]
  );
  const t4 = thread(
    "demo-t4",
    "Riley Patel",
    "Riley Patel",
    198,
    false,
    []
  );
  const threads = [t1, t2, t3, t4];

  return {
    dmParserVersion: 2,
    totalThreads: threads.length + 3,
    inboxThreads: threads.length,
    messageRequestThreads: 1,
    groupChatCount: 1,
    oneOnOneCount: threads.length - 1,
    totalMessages: threads.reduce((s, t) => s + t.messageCount, 0) + 340,
    messagesByMonth: [
      { month: "2025-09", count: 420 },
      { month: "2025-10", count: 680 },
      { month: "2025-11", count: 920 },
      { month: "2025-12", count: 750 },
      { month: "2026-01", count: 510 },
    ],
    threads,
    topThreads: threads,
  };
}

function buildCoverage(): DataCoverageItem[] {
  const ids = [
    ["followers_following", "Followers & Following", "Connection lists"],
    ["likes", "Likes", "Posts you liked"],
    ["comments", "Comments", "Comments you posted"],
    ["saved", "Saved", "Saved posts"],
    ["story_interactions", "Story Interactions", "Stories viewed"],
    ["messages", "Messages", "DM threads"],
    ["ads", "Ads", "Ad interactions"],
    ["advertisers", "Advertisers", "Advertisers who used your info"],
    ["login_activity", "Login Activity", "Login history"],
    ["search_history", "Search History", "Recent searches"],
    ["connected_apps", "Connected Apps", "Third-party apps"],
  ] as const;
  return ids.map(([id, label, description]) => ({
    id,
    label,
    description,
    detected: true,
    fileCount: 2,
  }));
}

const DEMO_FILE_PATHS = [
  "connections/followers_and_following/followers_1.json",
  "connections/followers_and_following/following.json",
  "your_instagram_activity/messages/inbox/demo_thread/message_1.json",
  "your_instagram_activity/likes/liked_posts.json",
  "your_instagram_activity/story_interactions/stories_viewed.json",
  "your_instagram_activity/searches/recent_searches.json",
  "ads_information/ads_and_topics/ads_viewed.json",
  "security_and_login_information/login_and_profile_activity/login_activity.json",
  "apps_and_websites/apps_and_websites.json",
];

export const DEMO_FILE_FINGERPRINT = "demo-synthetic-v1";

export function generateDemoData(): ParsedExportData {
  const network = buildNetwork();
  const wrapped: WrappedInsights = {
    likedPosts: 1240,
    likedComments: 86,
    postComments: 142,
    savedPosts: 67,
    storiesViewed: 3840,
    storyLikes: 210,
    pollInteractions: 34,
    emojiSliderInteractions: 18,
    quizzes: 6,
    videosWatched: 520,
    postsViewed: 1890,
  };
  const messages = buildMessages();
  const ads: AdsPrivacyData = {
    adsViewed: 312,
    adsClicked: 8,
    videosWatched: 94,
    postsViewed: 156,
    advertisersCount: 24,
    adCategoriesCount: 12,
    advertiserNames: [
      "Demo Brand Co",
      "FitLife Demo",
      "StreamBox Demo",
      "Campus Threads Demo",
    ],
    adCategories: [
      "Shopping",
      "Fitness",
      "Entertainment",
      "Education",
      "Tech",
    ],
  };
  const now = Date.now();
  const security: SecurityData = {
    loginCount: 48,
    logoutCount: 42,
    profileActivityCount: 6,
    privacyChangeCount: 2,
    passwordChangeCount: 1,
    events: [
      {
        id: "demo-login-1",
        type: "login",
        label: "Login from Chrome on Windows",
        timestamp: now - 86400000 * 2,
        location: "San Francisco, US",
        device: "Chrome / Windows",
        severity: "low",
      },
      {
        id: "demo-login-2",
        type: "login",
        label: "Login from Instagram app",
        timestamp: now - 86400000 * 14,
        location: "New York, US",
        device: "Instagram iOS",
        severity: "medium",
        notes: ["Different city than usual — worth a glance."],
      },
    ],
  };
  const mostActiveEra: MostActiveEraData = {
    mostActiveMonth: "2025-11",
    mostActiveMonthLabel: "November 2025",
    mostActiveMonthCount: 920,
    topActivityType: "DMs",
    topActivityCaption: "DMs peaked this month.",
    topMonths: [
      { month: "2025-11", label: "Nov 2025", count: 920 },
      { month: "2025-10", label: "Oct 2025", count: 680 },
      { month: "2025-12", label: "Dec 2025", count: 750 },
    ],
    monthlyTotals: [
      { month: "2025-09", label: "Sep 2025", count: 420 },
      { month: "2025-10", label: "Oct 2025", count: 680 },
      { month: "2025-11", label: "Nov 2025", count: 920 },
      { month: "2025-12", label: "Dec 2025", count: 750 },
      { month: "2026-01", label: "Jan 2026", count: 510 },
    ],
  };

  const searchJson = JSON.stringify({
    searches_serialized: [
      { string_list_data: [{ value: "campus events demo", timestamp: now - 86400000 * 3 }] },
      { string_list_data: [{ value: "coffee shop demo", timestamp: now - 86400000 * 7 }] },
      { string_list_data: [{ value: "jordan chen demo", timestamp: now - 86400000 * 12 }] },
    ],
  });
  const appsJson = JSON.stringify({
    apps_and_websites_off_platform: [
      { name: "Demo Photo Editor", added: now - 86400000 * 200 },
      { name: "Old Quiz App Demo", added: now - 86400000 * 800 },
    ],
  });

  const files = new Map<string, string>();
  files.set(
    "your_instagram_activity/searches/recent_searches.json",
    searchJson
  );
  files.set("apps_and_websites/apps_and_websites.json", appsJson);

  const base: ParsedExportData = {
    network,
    wrapped,
    messages,
    ads,
    security,
    mostActiveEra,
    insights: null,
    coverage: buildCoverage(),
    totalFiles: 142,
    jsonFiles: 38,
    mediaFiles: 12,
    filePaths: DEMO_FILE_PATHS,
    errors: [],
  };

  const insights = enrichInsightsBundle(
    computeInsightsBundle(base, files, []),
    base
  );

  return { ...base, insights };
}
