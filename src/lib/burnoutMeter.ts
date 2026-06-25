import type { ParsedExportData } from "@/types/instagram";
import type { ContentDietResult, BurnoutMeterResult } from "@/types/insights";
import type { ConfidenceLevel } from "@/types/insights";

export type { BurnoutMeterResult };

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function computeBurnoutMeter(
  parsed: ParsedExportData,
  contentDiet: ContentDietResult | null
): BurnoutMeterResult | null {
  const { messages, wrapped } = parsed;
  if (!wrapped && !messages) return null;

  const hourCounts = new Map<number, number>();
  const dayCounts = new Map<number, number>();
  let weekend = 0;
  let weekday = 0;
  let lateNight = 0;
  let totalTs = 0;

  for (const thread of messages?.threads ?? []) {
    for (const msg of thread.textMessages ?? []) {
      const ms = msg.timestamp_ms;
      if (!ms) continue;
      totalTs++;
      const d = new Date(ms);
      const hour = d.getUTCHours();
      const day = d.getUTCDay();
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
      dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
      if (day === 0 || day === 6) weekend++;
      else weekday++;
      if (hour >= 0 && hour <= 5) lateNight++;
    }
  }

  const mostActiveHour = [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const mostActiveDayNum = [...dayCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const mostActiveDay =
    mostActiveDayNum != null ? DAY_NAMES[mostActiveDayNum] : undefined;

  const peakMonth = messages?.messagesByMonth?.length
    ? [...messages.messagesByMonth].sort((a, b) => b.count - a.count)[0]
    : null;

  const passiveRatio = contentDiet?.passiveRatio ?? 0.55;
  const lateNightScore = totalTs > 0 ? Math.round((lateNight / totalTs) * 100) : 0;
  const touchGrassScore = clamp(
    100 -
      passiveRatio * 40 -
      lateNightScore * 0.35 -
      (contentDiet?.doomscrollScore ?? 30) * 0.25
  );
  const socialBatteryDrain = clamp(
    passiveRatio * 50 + lateNightScore * 0.4 + (wrapped?.storiesViewed ?? 0) / 500
  );
  const nightOwlScore = lateNightScore;

  const weekendVsWeekday: BurnoutMeterResult["weekendVsWeekday"] =
    weekend > weekday * 1.15
      ? "weekend"
      : weekday > weekend * 1.15
        ? "weekday"
        : "balanced";

  return {
    confidence: totalTs > 100 ? "medium" : totalTs > 20 ? "low" : "low",
    disclaimer:
      "Estimated from available export timestamps. Instagram may not include all activity.",
    mostActiveHour,
    mostActiveDay,
    peakDoomscrollMonth: peakMonth?.month,
    lateNightScore,
    passiveScrollingRatio: Math.round(passiveRatio * 100),
    touchGrassScore,
    socialBatteryDrain,
    secondHomeMonth: peakMonth?.month,
    weekendVsWeekday,
    nightOwlScore,
    metrics: [
      {
        label: "Stories viewed",
        value: (wrapped?.storiesViewed ?? 0).toLocaleString(),
      },
      {
        label: "Liked posts",
        value: (wrapped?.likedPosts ?? 0).toLocaleString(),
      },
      {
        label: "DM messages",
        value: (messages?.totalMessages ?? 0).toLocaleString(),
      },
      {
        label: "Passive scroll ratio",
        value: `${Math.round(passiveRatio * 100)}%`,
      },
    ],
  };
}

function clamp(n: number): number {
  return Math.round(Math.max(0, Math.min(100, n)));
}
