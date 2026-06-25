import { formatMonthKey, parseTimestamp } from "@/lib/formatters";
import type { ActivityTypeKey } from "@/types/instagram";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type MonthlyActivityByType = Map<ActivityTypeKey, Map<string, number>>;

function createMonthlyByType(): MonthlyActivityByType {
  return new Map();
}

function addMonthCount(
  map: MonthlyActivityByType,
  type: ActivityTypeKey,
  month: string,
  count: number
): void {
  if (!month || month === "unknown" || count <= 0) return;
  let typeMap = map.get(type);
  if (!typeMap) {
    typeMap = new Map();
    map.set(type, typeMap);
  }
  typeMap.set(month, (typeMap.get(month) ?? 0) + count);
}

function extractTimestamps(data: unknown): number[] {
  const timestamps: number[] = [];

  function walk(node: unknown): void {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (!isRecord(node)) return;

    const stringList = node.string_list_data;
    if (Array.isArray(stringList) && stringList.length > 0) {
      for (const entry of stringList) {
        if (!isRecord(entry)) continue;
        const ts = parseTimestamp(entry.timestamp ?? entry.timestamp_ms);
        if (ts) timestamps.push(ts);
      }
      return;
    }

    const direct = parseTimestamp(
      node.timestamp ?? node.timestamp_ms ?? node.creation_timestamp
    );
    if (direct) {
      timestamps.push(direct);
      return;
    }

    for (const value of Object.values(node)) {
      if (Array.isArray(value)) walk(value);
      else if (isRecord(value)) walk(value);
    }
  }

  walk(data);
  return timestamps;
}

function addTimestampsToMap(
  map: MonthlyActivityByType,
  type: ActivityTypeKey,
  timestamps: number[]
): void {
  const monthCounts = new Map<string, number>();
  const seen = new Set<number>();
  for (const ts of timestamps) {
    if (seen.has(ts)) continue;
    seen.add(ts);
    const month = formatMonthKey(ts);
    monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
  }
  for (const [month, count] of monthCounts) {
    addMonthCount(map, type, month, count);
  }
}

interface FileRule {
  fragment: string;
  type: ActivityTypeKey;
  /** If set, path must include this segment */
  pathIncludes?: string;
  /** If set, path must not include this segment */
  pathExcludes?: string;
}

const ACTIVITY_FILE_RULES: FileRule[] = [
  { fragment: "liked_posts.json", type: "likedPosts" },
  { fragment: "liked_comments.json", type: "likedComments" },
  { fragment: "post_comments", type: "postComments" },
  { fragment: "saved_posts.json", type: "savedPosts" },
  { fragment: "stories_viewed.json", type: "storiesViewed" },
  { fragment: "story_likes.json", type: "storyLikes" },
  { fragment: "polls.json", type: "pollInteractions" },
  { fragment: "emoji_sliders.json", type: "emojiSliders" },
  { fragment: "quizzes.json", type: "quizzes" },
  {
    fragment: "videos_watched.json",
    type: "videosWatched",
    pathIncludes: "your_instagram_activity",
  },
  {
    fragment: "posts_viewed.json",
    type: "postsViewed",
    pathIncludes: "your_instagram_activity",
  },
  {
    fragment: "videos_watched.json",
    type: "adsVideosWatched",
    pathIncludes: "ads_information",
  },
  {
    fragment: "posts_viewed.json",
    type: "adsPostsViewed",
    pathIncludes: "ads_information",
  },
];

function matchesRule(path: string, rule: FileRule): boolean {
  const lower = path.toLowerCase().replace(/\\/g, "/");
  if (!lower.includes(rule.fragment.toLowerCase())) return false;
  if (rule.pathIncludes && !lower.includes(rule.pathIncludes.toLowerCase())) {
    return false;
  }
  if (rule.pathExcludes && lower.includes(rule.pathExcludes.toLowerCase())) {
    return false;
  }
  return true;
}

/** Extract monthly activity counts from Instagram export JSON files */
export function parseActivityTimelineFromFiles(
  files: Map<string, string>
): MonthlyActivityByType {
  const map = createMonthlyByType();
  const processed = new Set<string>();

  for (const rule of ACTIVITY_FILE_RULES) {
    for (const [path, content] of files) {
      if (!matchesRule(path, rule)) continue;
      const key = `${rule.type}:${path}`;
      if (processed.has(key)) continue;
      processed.add(key);

      try {
        const data = JSON.parse(content);
        const timestamps = extractTimestamps(data);
        if (timestamps.length > 0) {
          addTimestampsToMap(map, rule.type, timestamps);
        }
      } catch {
        continue;
      }
    }
  }

  return map;
}
