import type { AdsPrivacyData } from "@/types/instagram";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const GENERIC_VALUES = new Set(
  [
    "name",
    "value",
    "label",
    "title",
    "category",
    "categories",
    "advertiser",
    "advertisers",
    "company",
    "timestamp",
    "href",
    "uri",
    "text",
    "description",
    "other categories used to reach you",
    "advertisers using your activity or information",
    "ads viewed",
    "ads clicked",
    "posts viewed",
    "videos watched",
  ].map((s) => s.toLowerCase())
);

const VALUE_FIELD_KEYS = new Set([
  "value",
  "title",
  "name",
  "label",
  "category",
  "advertiser_name",
  "company_name",
]);

const SKIP_RECURSE_KEYS = new Set([
  "string_list_data",
  "href",
  "uri",
  "timestamp",
  "timestamp_ms",
  "media",
  "media_list_data",
]);

function isUsefulString(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 2) return false;
  if (GENERIC_VALUES.has(trimmed.toLowerCase())) return false;
  if (/^\d+$/.test(trimmed)) return false;
  return true;
}

function dedupeSorted(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const trimmed = raw.trim();
    const key = trimmed.toLowerCase();
    if (!isUsefulString(trimmed) || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

function extractStrings(node: unknown): string[] {
  const found: string[] = [];

  function walk(value: unknown, parentKey?: string): void {
    if (typeof value === "string") {
      if (parentKey && VALUE_FIELD_KEYS.has(parentKey) && isUsefulString(value)) {
        found.push(value.trim());
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) walk(item, parentKey);
      return;
    }

    if (!isRecord(value)) return;

    if (Array.isArray(value.string_list_data)) {
      for (const entry of value.string_list_data) {
        if (!isRecord(entry)) continue;
        if (typeof entry.value === "string" && isUsefulString(entry.value)) {
          found.push(entry.value.trim());
        } else if (typeof entry.title === "string" && isUsefulString(entry.title)) {
          found.push(entry.title.trim());
        }
      }
    }

    if (typeof value.value === "string" && typeof value.label === "string") {
      const label = value.label.trim().toLowerCase();
      const val = value.value.trim();
      if (
        isUsefulString(val) &&
        label !== val.toLowerCase() &&
        !GENERIC_VALUES.has(label)
      ) {
        found.push(val);
      }
    }

    for (const [key, child] of Object.entries(value)) {
      if (SKIP_RECURSE_KEYS.has(key)) continue;

      if (VALUE_FIELD_KEYS.has(key) && typeof child === "string") {
        if (key === "label" && typeof value.value === "string") continue;
        if (key === "name" && parentKey === "dict") {
          // dict entries often use { label: "Name", value: "Nike" }
          continue;
        }
        if (isUsefulString(child)) found.push(child.trim());
        continue;
      }

      walk(child, key);
    }
  }

  walk(node);
  return found;
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
    "ig_custom_audience_all_types",
    "custom_audience_info",
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

function extractFromFiles(files: Map<string, string>, fragment: string): string[] {
  const target = fragment.toLowerCase();
  const values: string[] = [];

  for (const [path, content] of files) {
    const lower = path.toLowerCase().replace(/\\/g, "/");
    if (!lower.includes(target)) continue;
    try {
      values.push(...extractStrings(JSON.parse(content)));
    } catch {
      continue;
    }
  }

  return dedupeSorted(values);
}

export function parseAdsPrivacy(files: Map<string, string>): AdsPrivacyData | null {
  const adsViewed = findAndCount(files, "ads_viewed.json");
  const adsClicked = findAndCount(files, "ads_clicked.json");
  const videosWatched = findAndCount(files, "videos_watched.json");
  const postsViewed = findAndCount(files, "posts_viewed.json");

  const advertiserNames = extractFromFiles(
    files,
    "advertisers_using_your_activity_or_information.json"
  );
  const adCategories = extractFromFiles(
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
