import type { CoverageCategoryId, DataCoverageItem } from "@/types/instagram";

interface CategoryRule {
  id: CoverageCategoryId;
  label: string;
  description: string;
  patterns: string[];
  isMedia?: boolean;
}

const MEDIA_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".mp4",
  ".mov",
  ".heic",
];

const CATEGORIES: CategoryRule[] = [
  {
    id: "followers_following",
    label: "Followers & Following",
    description: "Connection lists, mutuals, and network data",
    patterns: [
      "followers",
      "following",
      "followers_and_following",
      "blocked_profiles",
      "restricted_profiles",
      "pending_follow",
    ],
  },
  {
    id: "likes",
    label: "Likes",
    description: "Posts and comments you liked",
    patterns: ["liked_posts", "liked_comments", "/likes/"],
  },
  {
    id: "comments",
    label: "Comments",
    description: "Comments you posted",
    patterns: ["post_comments", "/comments/"],
  },
  {
    id: "saved",
    label: "Saved",
    description: "Posts you saved",
    patterns: ["saved_posts", "/saved/"],
  },
  {
    id: "story_interactions",
    label: "Story Interactions",
    description: "Stories viewed, likes, polls, and quizzes",
    patterns: [
      "story_interactions",
      "stories_viewed",
      "story_likes",
      "polls.json",
      "emoji_sliders",
      "quizzes",
    ],
  },
  {
    id: "posts_viewed",
    label: "Posts Viewed",
    description: "Posts you viewed in feed or ads",
    patterns: ["posts_viewed"],
  },
  {
    id: "videos_watched",
    label: "Videos Watched",
    description: "Video watch history from ads/topics",
    patterns: ["videos_watched"],
  },
  {
    id: "ads",
    label: "Ads Viewed & Clicked",
    description: "Ad impressions and clicks",
    patterns: ["ads_viewed", "ads_clicked", "ads_and_topics"],
  },
  {
    id: "advertisers",
    label: "Advertisers",
    description: "Advertisers and categories targeting you",
    patterns: [
      "advertisers_using",
      "other_categories_used",
      "instagram_ads_and_businesses",
    ],
  },
  {
    id: "messages",
    label: "Messages",
    description: "DM threads and message requests",
    patterns: ["/messages/", "message_1.json"],
  },
  {
    id: "login_activity",
    label: "Login Activity",
    description: "Login and logout history",
    patterns: ["login_activity", "logout_activity"],
  },
  {
    id: "profile_activity",
    label: "Profile Activity",
    description: "Profile edits and bio changes",
    patterns: ["profile_activity", "signup_details"],
  },
  {
    id: "security_changes",
    label: "Security Changes",
    description: "Password and privacy setting changes",
    patterns: [
      "password_change",
      "profile_privacy_changes",
      "security_and_login",
    ],
  },
  {
    id: "personal_information",
    label: "Personal Information",
    description: "Account info and personal details",
    patterns: ["personal_information", "account_information"],
  },
  {
    id: "media_files",
    label: "Media Files",
    description: "Photos and videos from your export",
    patterns: [],
    isMedia: true,
  },
];

function pathMatches(path: string, patterns: string[]): boolean {
  const lower = path.toLowerCase().replace(/\\/g, "/");
  return patterns.some((p) => lower.includes(p.toLowerCase()));
}

function isMediaFile(path: string): boolean {
  const lower = path.toLowerCase();
  return MEDIA_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function isJsonFile(path: string): boolean {
  return path.toLowerCase().endsWith(".json");
}

export function parseDataCoverage(filePaths: string[]): {
  coverage: DataCoverageItem[];
  totalFiles: number;
  jsonFiles: number;
  mediaFiles: number;
} {
  const normalized = filePaths.map((p) => p.replace(/\\/g, "/"));
  const jsonFiles = normalized.filter(isJsonFile).length;
  const mediaFiles = normalized.filter(isMediaFile).length;

  const coverage = CATEGORIES.map((cat) => {
    let fileCount = 0;

    if (cat.isMedia) {
      fileCount = mediaFiles;
    } else {
      for (const path of normalized) {
        if (isJsonFile(path) && pathMatches(path, cat.patterns)) {
          fileCount++;
        }
      }
    }

    return {
      id: cat.id,
      label: cat.label,
      description: cat.description,
      detected: fileCount > 0,
      fileCount,
    };
  });

  return {
    coverage,
    totalFiles: normalized.length,
    jsonFiles,
    mediaFiles,
  };
}
