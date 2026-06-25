import {
  isValidAccountName,
  sanitizeAccountName,
  cleanRawDisplayName,
} from "@/lib/accountNameFilter";
import {
  compactIdentityKey,
  normalizeIdentityKey,
} from "@/lib/identityResolver";
import type { NameConfidence, AttributionStatus } from "@/types/insights";

export interface InteractionCounts {
  likes: number;
  comments: number;
  stories: number;
  saves: number;
}

export interface InteractionExportMeta {
  likesFilePresent: boolean;
  commentsFilePresent: boolean;
  storiesFilePresent: boolean;
  hasAccountLevelLikes: boolean;
  hasAccountLevelComments: boolean;
  hasAccountLevelStories: boolean;
  likesSourcePath?: string;
  commentsSourcePath?: string;
  storiesSourcePath?: string;
}

const RULES: {
  fragment: string;
  field: keyof InteractionCounts;
  metaKey: keyof Pick<
    InteractionExportMeta,
    "likesFilePresent" | "commentsFilePresent" | "storiesFilePresent"
  >;
  pathKey: keyof Pick<
    InteractionExportMeta,
    "likesSourcePath" | "commentsSourcePath" | "storiesSourcePath"
  >;
}[] = [
  {
    fragment: "liked_posts",
    field: "likes",
    metaKey: "likesFilePresent",
    pathKey: "likesSourcePath",
  },
  {
    fragment: "liked_comments",
    field: "likes",
    metaKey: "likesFilePresent",
    pathKey: "likesSourcePath",
  },
  {
    fragment: "post_comments",
    field: "comments",
    metaKey: "commentsFilePresent",
    pathKey: "commentsSourcePath",
  },
  {
    fragment: "stories_viewed",
    field: "stories",
    metaKey: "storiesFilePresent",
    pathKey: "storiesSourcePath",
  },
  {
    fragment: "story_likes",
    field: "stories",
    metaKey: "storiesFilePresent",
    pathKey: "storiesSourcePath",
  },
  { fragment: "saved_posts", field: "saves", metaKey: "likesFilePresent", pathKey: "likesSourcePath" },
];

function usernameFromHref(href: string): string | null {
  const match = href.match(
    /instagram\.com\/(?!p\/|reel\/|tv\/|stories\/)([a-zA-Z0-9._]+)/i
  );
  if (!match?.[1]) return null;
  const user = match[1].toLowerCase();
  if (["explore", "accounts", "direct", "stories"].includes(user)) return null;
  return sanitizeAccountName(user);
}

function registerKey(
  map: Map<string, InteractionCounts>,
  raw: string,
  field: keyof InteractionCounts
): boolean {
  const sanitized = sanitizeAccountName(raw);
  const keys = new Set<string>();
  if (sanitized) keys.add(sanitized);
  const compact = compactIdentityKey(raw);
  if (compact.length >= 2) keys.add(compact);
  const normalized = normalizeIdentityKey(raw).replace(/\s+/g, "");
  if (normalized.length >= 2) keys.add(normalized);

  let added = false;
  for (const key of keys) {
    const existing = map.get(key) ?? {
      likes: 0,
      comments: 0,
      stories: 0,
      saves: 0,
    };
    existing[field]++;
    map.set(key, existing);
    added = true;
  }
  return added;
}

function extractAccountKeys(data: unknown, onKey: (key: string) => void): void {
  if (Array.isArray(data)) {
    data.forEach((item) => extractAccountKeys(item, onKey));
    return;
  }
  if (typeof data !== "object" || data === null) return;
  const obj = data as Record<string, unknown>;

  if (typeof obj.title === "string" && obj.title.trim()) {
    const title = cleanRawDisplayName(obj.title.trim());
    if (isValidAccountName(title) && !title.includes("http")) {
      onKey(title);
    }
  }

  if (Array.isArray(obj.string_list_data)) {
    for (const entry of obj.string_list_data) {
      if (typeof entry !== "object" || entry === null) continue;
      const row = entry as Record<string, unknown>;
      if (typeof row.href === "string") {
        const fromHref = usernameFromHref(row.href);
        if (fromHref) onKey(fromHref);
      }
      if (typeof row.value === "string" && row.value.trim() && !row.value.includes("http")) {
        const v = cleanRawDisplayName(row.value.trim());
        if (isValidAccountName(v)) onKey(v);
      }
    }
  }

  for (const val of Object.values(obj)) {
    if (Array.isArray(val) || (typeof val === "object" && val !== null)) {
      extractAccountKeys(val, onKey);
    }
  }
}

export function getInteractionExportMeta(
  files: Map<string, string>
): InteractionExportMeta {
  const meta: InteractionExportMeta = {
    likesFilePresent: false,
    commentsFilePresent: false,
    storiesFilePresent: false,
    hasAccountLevelLikes: false,
    hasAccountLevelComments: false,
    hasAccountLevelStories: false,
  };

  for (const rule of RULES) {
    for (const [path] of files) {
      const lower = path.toLowerCase().replace(/\\/g, "/");
      if (!lower.includes(rule.fragment)) continue;
      meta[rule.metaKey] = true;
      if (!meta[rule.pathKey]) meta[rule.pathKey] = path;
    }
  }

  return meta;
}

export function extractInteractionAccounts(
  files: Map<string, string>
): {
  map: Map<string, InteractionCounts>;
  meta: InteractionExportMeta;
} {
  const map = new Map<string, InteractionCounts>();
  const meta = getInteractionExportMeta(files);
  const fieldHits: Record<keyof InteractionCounts, boolean> = {
    likes: false,
    comments: false,
    stories: false,
    saves: false,
  };

  for (const rule of RULES) {
    for (const [path, content] of files) {
      const lower = path.toLowerCase().replace(/\\/g, "/");
      if (!lower.includes(rule.fragment)) continue;
      try {
        const data = JSON.parse(content);
        extractAccountKeys(data, (key) => {
          if (registerKey(map, key, rule.field)) {
            fieldHits[rule.field] = true;
          }
        });
      } catch {
        continue;
      }
    }
  }

  meta.hasAccountLevelLikes = fieldHits.likes;
  meta.hasAccountLevelComments = fieldHits.comments;
  meta.hasAccountLevelStories = fieldHits.stories;

  return { map, meta };
}

export type InteractionMatchConfidence = NameConfidence;

export interface ResolvedInteractionStats {
  likes: number;
  comments: number;
  stories: number;
  likesStatus: AttributionStatus;
  commentsStatus: AttributionStatus;
  storiesStatus: AttributionStatus;
  likesConfidence?: InteractionMatchConfidence;
  commentsConfidence?: InteractionMatchConfidence;
  storiesConfidence?: InteractionMatchConfidence;
}

export function resolveInteractionsForAliases(
  aliases: string[],
  interactionCounts: Map<string, InteractionCounts> | undefined,
  meta: InteractionExportMeta | undefined
): ResolvedInteractionStats {
  const empty: ResolvedInteractionStats = {
    likes: 0,
    comments: 0,
    stories: 0,
    likesStatus: "not_in_export",
    commentsStatus: "not_in_export",
    storiesStatus: "not_in_export",
  };

  if (!meta) return empty;

  const resolveField = (
    field: keyof InteractionCounts,
    filePresent: boolean,
    hasAccountLevel: boolean
  ): {
    count: number;
    status: AttributionStatus;
    confidence?: InteractionMatchConfidence;
  } => {
    if (!filePresent) {
      return { count: 0, status: "not_in_export" };
    }
    if (!hasAccountLevel || !interactionCounts?.size) {
      return { count: 0, status: "not_account_level" };
    }

    const keys = new Set<string>();
    for (const alias of aliases) {
      if (!alias?.trim()) continue;
      keys.add(alias);
      keys.add(normalizeIdentityKey(alias));
      keys.add(compactIdentityKey(alias));
      const sanitized = sanitizeAccountName(alias);
      if (sanitized) keys.add(sanitized);
    }

    for (const key of keys) {
      const direct = interactionCounts.get(key);
      if (direct && direct[field] > 0) {
        const confidence: InteractionMatchConfidence =
          key === aliases[0] || key === sanitizeAccountName(aliases[0] ?? "")
            ? "high"
            : "medium";
        return { count: direct[field], status: "attributed", confidence };
      }
    }

    for (const [mapKey, val] of interactionCounts) {
      for (const key of keys) {
        if (
          compactIdentityKey(mapKey) === compactIdentityKey(key) &&
          val[field] > 0
        ) {
          return { count: val[field], status: "attributed", confidence: "medium" };
        }
      }
    }

    return { count: 0, status: "not_matched" };
  };

  const likes = resolveField(
    "likes",
    meta.likesFilePresent,
    meta.hasAccountLevelLikes
  );
  const comments = resolveField(
    "comments",
    meta.commentsFilePresent,
    meta.hasAccountLevelComments
  );
  const stories = resolveField(
    "stories",
    meta.storiesFilePresent,
    meta.hasAccountLevelStories
  );

  return {
    likes: likes.count,
    comments: comments.count,
    stories: stories.count,
    likesStatus: likes.status,
    commentsStatus: comments.status,
    storiesStatus: stories.status,
    likesConfidence: likes.confidence,
    commentsConfidence: comments.confidence,
    storiesConfidence: stories.confidence,
  };
}
