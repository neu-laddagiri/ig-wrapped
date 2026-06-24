import type { WrappedInsights } from "@/types/instagram";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function countArrayItems(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  return 0;
}

function countFromKnownKeys(data: unknown, keys: string[]): number {
  if (!isRecord(data)) return countArrayItems(data);

  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) return value.length;
  }

  let total = 0;
  for (const value of Object.values(data)) {
    if (Array.isArray(value)) total += value.length;
  }
  return total > 0 ? total : countArrayItems(data);
}

function findAndCount(
  files: Map<string, string>,
  pathFragment: string,
  keys: string[] = []
): number {
  const fragment = pathFragment.toLowerCase();
  for (const [path, content] of files) {
    const lower = path.toLowerCase().replace(/\\/g, "/");
    if (!lower.includes(fragment)) continue;
    try {
      const data = JSON.parse(content);
      return keys.length > 0 ? countFromKnownKeys(data, keys) : countArrayItems(data) || countFromKnownKeys(data, []);
    } catch {
      continue;
    }
  }
  return 0;
}

const EMPTY: WrappedInsights = {
  likedPosts: 0,
  likedComments: 0,
  postComments: 0,
  savedPosts: 0,
  storiesViewed: 0,
  storyLikes: 0,
  pollInteractions: 0,
  emojiSliderInteractions: 0,
  quizzes: 0,
  videosWatched: 0,
  postsViewed: 0,
};

export function parseWrappedInsights(
  files: Map<string, string>
): WrappedInsights {
  return {
    likedPosts: findAndCount(files, "liked_posts.json", [
      "likes_media_likes",
      "media",
    ]),
    likedComments: findAndCount(files, "liked_comments.json", [
      "likes_comment_likes",
    ]),
    postComments: findAndCount(files, "post_comments", [
      "comments_comment",
      "comments",
    ]),
    savedPosts: findAndCount(files, "saved_posts.json", [
      "saved_saved_media",
    ]),
    storiesViewed: findAndCount(files, "stories_viewed.json", [
      "story_activities_story_view",
    ]),
    storyLikes: findAndCount(files, "story_likes.json"),
    pollInteractions: findAndCount(files, "polls.json"),
    emojiSliderInteractions: findAndCount(files, "emoji_sliders.json"),
    quizzes: findAndCount(files, "quizzes.json"),
    videosWatched: findAndCount(files, "videos_watched.json", [
      "impressions_history_ads_seen",
      "videos_watched",
    ]),
    postsViewed: findAndCount(files, "posts_viewed.json", [
      "impressions_history_posts_seen",
      "posts_viewed",
    ]),
  };
}

export function hasWrappedData(insights: WrappedInsights): boolean {
  return Object.values(insights).some((v) => v > 0);
}

export { EMPTY as EMPTY_WRAPPED_INSIGHTS };
