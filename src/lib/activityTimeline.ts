import { formatMonthLabel } from "@/lib/formatters";
import { computeMostActiveEra } from "@/lib/mostActiveEra";
import type {
  ActivityTypeKey,
  MostActiveEraData,
  ParsedExportData,
  SecurityData,
} from "@/types/instagram";
import type { EraLabel, ErasTimeline } from "@/types/insights";

const ACTIVITY_LABELS: Record<string, string> = {
  dms: "DMs",
  likedPosts: "likes",
  storiesViewed: "story views",
  videosWatched: "videos",
  postsViewed: "posts viewed",
  following: "follows",
  followers: "followers",
  postComments: "comments",
  savedPosts: "saves",
};

function inferEraLabel(
  month: string,
  topType: string | undefined,
  count: number,
  securitySpike?: boolean
): EraLabel {
  const label = formatMonthLabel(month);
  let eraName = "Active Era";
  let caption = "A busy month on Instagram.";

  if (securitySpike) {
    eraName = "Security Event Era";
    caption = "Notable account security activity this month.";
  } else if (topType === "dms") {
    eraName = "DM Peak Era";
    caption = "Your inbox was working overtime.";
  } else if (topType === "storiesViewed") {
    eraName = "Story Watcher Era";
    caption = "Stories had your full attention.";
  } else if (topType === "videosWatched" || topType === "postsViewed") {
    eraName = "Doomscroll Era";
    caption = "Feed and video consumption spiked.";
  } else if (topType === "following" || topType === "followers") {
    eraName = "Follow Spree Era";
    caption = "Network growth was the main event.";
  } else if (topType === "likedPosts") {
    eraName = "Generous Liker Era";
    caption = "You were handing out likes freely.";
  } else if (count < 20) {
    eraName = "Ghost Mode Era";
    caption = "Light activity — quiet month.";
  }

  return { month, label: eraName, caption, count, topActivityType: topType };
}

function securityMonths(security: SecurityData | null): Set<string> {
  const months = new Set<string>();
  for (const e of security?.events ?? []) {
    if (!e.timestamp) continue;
    const d = new Date(e.timestamp * 1000);
    months.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export function buildErasTimeline(
  parsed: ParsedExportData,
  mostActiveEra: MostActiveEraData | null
): ErasTimeline | null {
  const era =
    mostActiveEra ??
    computeMostActiveEra({
      files: parsed.filePaths.length
        ? new Map(parsed.filePaths.map((p) => [p, ""]))
        : undefined,
      messages: parsed.messages,
      network: parsed.network,
      ads: parsed.ads,
    });

  if (!era?.monthlyTotals.length) return null;

  const secMonths = securityMonths(parsed.security);
  const monthlyTotals = era.monthlyTotals;
  const topMonths = era.topMonths;

  const eraLabels: EraLabel[] = topMonths.map((m) => {
    const topType = era.topActivityTypes?.[0]
      ?.toLowerCase()
      .includes("dm")
      ? "dms"
      : undefined;
    return inferEraLabel(
      m.month,
      topType,
      m.count,
      secMonths.has(m.month)
    );
  });

  let trend: ErasTimeline["trend"] = "unknown";
  if (monthlyTotals.length >= 3) {
    const recent = monthlyTotals.slice(-3).map((m) => m.count);
    const older = monthlyTotals.slice(-6, -3).map((m) => m.count);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg =
      older.length > 0
        ? older.reduce((a, b) => a + b, 0) / older.length
        : recentAvg;
    if (recentAvg > olderAvg * 1.15) trend = "rising";
    else if (recentAvg < olderAvg * 0.85) trend = "falling";
    else trend = "stable";
  }

  return {
    monthlyTotals,
    topMonths,
    peakMonth: topMonths[0],
    eraLabels,
    trend,
  };
}
