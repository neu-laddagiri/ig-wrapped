import type { DmAnalytics } from "@/types/instagram";
import type { DmHeatmapResult } from "@/types/insights";
import { isLateNightHour, localHourAndDay } from "@/lib/timeOfDay";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function computeDmHeatmap(
  messages: DmAnalytics | null
): DmHeatmapResult {
  const empty: DmHeatmapResult = {
    cells: [],
    mostActiveDay: "—",
    mostActiveHour: "—",
    lateNightStreak: 0,
    longestDroughtDays: 0,
    totalTimestamped: 0,
    available: false,
  };
  if (!messages?.threads?.length) return empty;

  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  const timestamps: number[] = [];
  let lateNight = 0;

  for (const thread of messages.threads) {
    const samples = thread.textMessages ?? [];
    for (const m of samples) {
      if (!m.timestamp_ms) continue;
      timestamps.push(m.timestamp_ms);
      const { hour, day } = localHourAndDay(m.timestamp_ms);
      grid[day][hour]++;
      if (isLateNightHour(hour)) lateNight++;
    }
  }

  if (timestamps.length < 5) return empty;

  timestamps.sort((a, b) => a - b);
  const cells: DmHeatmapResult["cells"] = [];
  let maxCount = 0;
  let maxDay = 0;
  let maxHour = 0;

  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const count = grid[day][hour];
      cells.push({ day, hour, count });
      if (count > maxCount) {
        maxCount = count;
        maxDay = day;
        maxHour = hour;
      }
    }
  }

  let maxGap = 0;
  for (let i = 1; i < timestamps.length; i++) {
    const gap = (timestamps[i] - timestamps[i - 1]) / 86400000;
    if (gap > maxGap) maxGap = gap;
  }

  return {
    cells,
    mostActiveDay: DAY_NAMES[maxDay],
    mostActiveHour: `${maxHour}:00`,
    lateNightStreak: lateNight,
    longestDroughtDays: Math.round(maxGap),
    totalTimestamped: timestamps.length,
    available: true,
  };
}
