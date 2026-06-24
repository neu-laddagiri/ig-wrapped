import type { AdsPrivacyData } from "@/types/instagram";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function countItems(data: unknown): number {
  if (Array.isArray(data)) return data.length;
  if (!isRecord(data)) return 0;

  const keys = [
    "impressions_history_ads_seen",
    "impressions_history_posts_seen",
    "videos_watched",
    "ads_clicked",
    "ads_viewed",
    "label_values",
    "inferred_data_from_your_activity",
    "inferred_data_from_your_information",
  ];

  for (const key of keys) {
    const value = data[key];
    if (Array.isArray(value)) return value.length;
  }

  let total = 0;
  for (const value of Object.values(data)) {
    if (Array.isArray(value)) total += value.length;
  }
  return total;
}

function findAndCount(files: Map<string, string>, fragment: string): number {
  const target = fragment.toLowerCase();
  for (const [path, content] of files) {
    const lower = path.toLowerCase().replace(/\\/g, "/");
    if (!lower.includes(target)) continue;
    try {
      return countItems(JSON.parse(content));
    } catch {
      continue;
    }
  }
  return 0;
}

function extractNames(files: Map<string, string>, fragment: string): string[] {
  const target = fragment.toLowerCase();
  const names: string[] = [];

  for (const [path, content] of files) {
    const lower = path.toLowerCase().replace(/\\/g, "/");
    if (!lower.includes(target)) continue;
    try {
      const data = JSON.parse(content);
      if (!Array.isArray(data)) {
        if (isRecord(data)) {
          for (const value of Object.values(data)) {
            if (Array.isArray(value)) {
              for (const item of value) {
                if (isRecord(item)) {
                  const label = item.label ?? item.title ?? item.value;
                  if (typeof label === "string") names.push(label);
                }
              }
            }
          }
        }
        continue;
      }
      for (const item of data) {
        if (!isRecord(item)) continue;
        const label =
          item.label ??
          item.title ??
          item.value ??
          (Array.isArray(item.string_list_data) &&
          isRecord(item.string_list_data[0])
            ? item.string_list_data[0].value
            : undefined);
        if (typeof label === "string") names.push(label);
      }
    } catch {
      continue;
    }
  }

  return [...new Set(names)];
}

export function parseAdsPrivacy(files: Map<string, string>): AdsPrivacyData | null {
  const adsViewed = findAndCount(files, "ads_viewed.json");
  const adsClicked = findAndCount(files, "ads_clicked.json");
  const videosWatched = findAndCount(files, "videos_watched.json");
  const postsViewed = findAndCount(files, "posts_viewed.json");
  const advertiserNames = extractNames(
    files,
    "advertisers_using_your_activity_or_information.json"
  );
  const adCategories = extractNames(
    files,
    "other_categories_used_to_reach_you.json"
  );

  const hasData =
    adsViewed > 0 ||
    adsClicked > 0 ||
    videosWatched > 0 ||
    postsViewed > 0 ||
    advertiserNames.length > 0 ||
    adCategories.length > 0;

  if (!hasData) return null;

  return {
    adsViewed,
    adsClicked,
    videosWatched,
    postsViewed,
    advertisersCount: advertiserNames.length,
    adCategoriesCount: adCategories.length,
    advertiserNames,
    adCategories,
  };
}
