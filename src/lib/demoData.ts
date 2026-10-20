import type {
  AdsPrivacyData,
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
import { DM_PARSER_VERSION } from "@/lib/parsers/messagesParser";
import { parseDataCoverage } from "@/lib/parsers/dataCoverageParser";
import { formatMonthLabel } from "@/lib/formatters";

// Demo data must use the same units the real parsers emit: unix seconds for
// network/activity/security/thread timestamps, ms only for DM sample timestamp_ms.
const DAY_S = 86400;

/** The export owner, as Instagram writes them in DMs (never "You"). */
const DEMO_OWNER_NAME = "Demo User";
const DEMO_OWNER_USERNAME = "demo.user";

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

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function slugFor(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "_");
}

function demoUser(i: number): InstagramAccount {
  const name = DEMO_NAMES[i % DEMO_NAMES.length];
  const round = Math.floor(i / DEMO_NAMES.length);
  // Names repeat across rounds, so suffix the round to keep usernames unique.
  const slug = `${slugFor(name)}${round > 0 ? round + 1 : ""}_demo`;
  return {
    username: slug,
    displayUsername: slug,
    href: `https://www.instagram.com/${slug}/`,
    timestamp: nowSeconds() - (i + 1) * DAY_S * 14,
  };
}

/** Month keys for the last `count` months, oldest first. */
function recentMonths(count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 15);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

function buildNetwork(): NetworkStats {
  const followers = Array.from({ length: 48 }, (_, i) => demoUser(i));
  // The DM friends (first names in DEMO_NAMES) are mutuals.
  const following = [
    ...Array.from({ length: 34 }, (_, i) => demoUser(i)),
    ...Array.from({ length: 38 }, (_, i) => demoUser(i + 48)),
  ];
  const followerSet = new Set(followers.map((a) => a.username));
  const followingSet = new Set(following.map((a) => a.username));
  const mutuals = followers.filter((f) => followingSet.has(f.username));

  return {
    totalFollowers: followers.length,
    totalFollowing: following.length,
    mutuals,
    dontFollowMeBack: following.filter((f) => !followerSet.has(f.username)),
    iDontFollowBack: followers.filter((f) => !followingSet.has(f.username)),
    followBackRatio:
      following.length > 0 ? mutuals.length / following.length : 0,
    pendingRequests: [demoUser(90)],
    recentFollowRequests: [demoUser(91), demoUser(92)],
    recentlyUnfollowed: [demoUser(93)],
    blocked: [],
    restricted: [],
    followers,
    following,
  };
}

function buildMessages(months: string[]): DmAnalytics {
  const now = nowSeconds();
  let folderId = 17843264891230000;

  function thread(
    id: string,
    name: string,
    partner: string,
    msgCount: number,
    isGroup: boolean,
    participants: string[]
  ): DmThreadAnalytics {
    // Real inbox folders are "<slug>_<numeric thread id>".
    const folder = `${isGroup ? slugFor(name).replace(/_/g, "") : `${slugFor(partner)}_demo`}_${folderId++}`;
    const lead = isGroup ? participants[1] : partner;
    const messagesBySender: Record<string, number> = {};
    if (isGroup) {
      participants.forEach((p, i) => {
        messagesBySender[p] = Math.floor(msgCount / participants.length) + i * 3;
      });
    } else {
      messagesBySender[DEMO_OWNER_NAME] = Math.floor(msgCount * 0.52);
      messagesBySender[partner] = msgCount - messagesBySender[DEMO_OWNER_NAME];
    }

    const textMessages: DmMessageSample[] = [];
    if (!isGroup) {
      let t = (now - DAY_S * 30) * 1000;
      let sender = partner;
      for (let i = 0; i < Math.min(40, msgCount); i++) {
        textMessages.push({
          sender_name: sender,
          timestamp_ms: t,
          content: `Demo message ${i + 1}`,
        });
        sender = sender === DEMO_OWNER_NAME ? partner : DEMO_OWNER_NAME;
        t += (i % 3 === 0 ? 120000 : 3600000) + Math.random() * 600000;
      }
    }

    const perMonth = months.map((month, i) => ({
      month,
      count: Math.floor(msgCount / months.length) + i * 12,
    }));
    return {
      id,
      threadName: name,
      title: name,
      threadPath: `inbox/${folder}`,
      sourcePath: `your_instagram_activity/messages/inbox/${folder}/message_1.json`,
      participants: isGroup ? participants : [partner, DEMO_OWNER_NAME],
      participantCount: isGroup ? participants.length : 2,
      isGroupChat: isGroup,
      messageCount: msgCount,
      folder: "inbox",
      messagesBySender,
      firstMessageTimestamp: now - DAY_S * 90,
      lastMessageTimestamp: now - DAY_S * 2,
      firstMessageSender: lead,
      lastMessageSender: DEMO_OWNER_NAME,
      firstMessagePreview: "Hey! demo chat preview.",
      mostActiveMonth: [...perMonth].sort((a, b) => b.count - a.count)[0]
        ?.month,
      messagesByMonth: perMonth,
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
      reelsLinksBySender: { [lead]: 3 },
      postLinksBySender: { [DEMO_OWNER_NAME]: 2 },
      funSummary: isGroup
        ? "Group chat energy with steady meme traffic."
        : "Balanced back-and-forth with reel links.",
      textMessages,
    };
  }

  const threads = [
    thread("demo-t1", "Alex Rivera", "Alex Rivera", 842, false, []),
    thread("demo-t2", "Jordan Chen", "Jordan Chen", 521, false, []),
    thread("demo-t3", "Weekend Crew", "", 1204, true, [
      DEMO_OWNER_NAME,
      "Sam Okonkwo",
      "Taylor Brooks",
      "Morgan Lee",
      "Casey Kim",
    ]),
    thread("demo-t4", "Riley Patel", "Riley Patel", 198, false, []),
  ];

  const monthTotals = new Map<string, number>();
  for (const t of threads) {
    for (const { month, count } of t.messagesByMonth) {
      monthTotals.set(month, (monthTotals.get(month) ?? 0) + count);
    }
  }

  return {
    dmParserVersion: DM_PARSER_VERSION,
    totalThreads: threads.length,
    inboxThreads: threads.length,
    messageRequestThreads: 0,
    groupChatCount: 1,
    oneOnOneCount: threads.length - 1,
    totalMessages: threads.reduce((s, t) => s + t.messageCount, 0),
    messagesByMonth: months.map((month) => ({
      month,
      count: monthTotals.get(month) ?? 0,
    })),
    threads,
    topThreads: threads,
  };
}

const DEMO_FILE_PATHS = [
  "connections/followers_and_following/followers_1.json",
  "connections/followers_and_following/following.json",
  "connections/followers_and_following/pending_follow_requests.json",
  "your_instagram_activity/messages/inbox/alex_rivera_demo_17843264891230000/message_1.json",
  "your_instagram_activity/likes/liked_posts.json",
  "your_instagram_activity/comments/post_comments_1.json",
  "your_instagram_activity/saved/saved_posts.json",
  "your_instagram_activity/story_interactions/story_likes.json",
  "ads_information/ads_and_topics/ads_viewed.json",
  "ads_information/ads_and_topics/posts_viewed.json",
  "ads_information/ads_and_topics/videos_watched.json",
  "ads_information/instagram_ads_and_businesses/advertisers_using_your_activity_or_information.json",
  "security_and_login_information/login_and_profile_creation/login_activity.json",
  "security_and_login_information/login_and_profile_creation/password_change_activity.json",
  "security_and_login_information/login_and_profile_creation/profile_activity.json",
  "personal_information/personal_information/personal_information.json",
  "logged_information/recent_searches/account_searches.json",
  "logged_information/recent_searches/word_or_phrase_searches.json",
  "apps_and_websites_off_of_instagram/apps_and_websites/active_apps.json",
  "media/posts/202601/demo_photo.jpg",
];

export const DEMO_FILE_FINGERPRINT = "demo-synthetic-v1";

export function generateDemoData(): ParsedExportData {
  const now = nowSeconds();
  const months = recentMonths(5);
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
  const messages = buildMessages(months);
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
        label: "Login",
        timestamp: now - DAY_S * 2,
        device: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0",
        severity: "low",
      },
      {
        id: "demo-login-2",
        type: "login",
        label: "Login",
        timestamp: now - DAY_S * 14,
        device: "Instagram 330.0 (iPhone15,2; iOS 18_1)",
        severity: "low",
      },
    ],
  };

  const monthCounts = messages.messagesByMonth;
  const peak = [...monthCounts].sort((a, b) => b.count - a.count)[0];
  const mostActiveEra: MostActiveEraData = {
    mostActiveMonth: peak.month,
    mostActiveMonthLabel: formatMonthLabel(peak.month),
    mostActiveMonthCount: peak.count,
    topActivityType: "DMs",
    topActivityCaption: "DMs peaked this month.",
    topMonths: [...monthCounts]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(({ month, count }) => ({ month, label: formatMonthLabel(month), count })),
    monthlyTotals: monthCounts.map(({ month, count }) => ({
      month,
      label: formatMonthLabel(month),
      count,
    })),
  };

  // Synthetic files in the real export shapes, so owner detection, search and
  // connected-app parsing take the same code paths as an uploaded ZIP.
  const files = new Map<string, string>();
  files.set(
    "personal_information/personal_information/personal_information.json",
    JSON.stringify({
      profile_user: [
        {
          string_map_data: {
            Username: { value: DEMO_OWNER_USERNAME },
            Name: { value: DEMO_OWNER_NAME },
          },
        },
      ],
    })
  );
  files.set(
    "logged_information/recent_searches/account_searches.json",
    JSON.stringify({
      searches_user: [
        { string_map_data: { Search: { value: "jordan_chen_demo" }, Time: { timestamp: now - DAY_S * 12 } } },
        { string_map_data: { Search: { value: "alex_rivera_demo" }, Time: { timestamp: now - DAY_S * 20 } } },
      ],
    })
  );
  files.set(
    "logged_information/recent_searches/word_or_phrase_searches.json",
    JSON.stringify({
      searches_keyword: [
        { string_map_data: { Search: { value: "campus events demo" }, Time: { timestamp: now - DAY_S * 3 } } },
        { string_map_data: { Search: { value: "coffee shop demo" }, Time: { timestamp: now - DAY_S * 7 } } },
      ],
    })
  );
  files.set(
    "apps_and_websites_off_of_instagram/apps_and_websites/active_apps.json",
    JSON.stringify({
      apps_and_websites_active_apps: [
        { title: "Demo Photo Editor", string_map_data: { "Added on": { timestamp: now - DAY_S * 200 } } },
        { title: "Old Quiz App Demo", string_map_data: { "Added on": { timestamp: now - DAY_S * 800 } } },
      ],
    })
  );

  const base: ParsedExportData = {
    network,
    wrapped,
    messages,
    ads,
    security,
    mostActiveEra,
    insights: null,
    coverage: parseDataCoverage(DEMO_FILE_PATHS).coverage,
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
