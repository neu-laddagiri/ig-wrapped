/**
 * Shared time-of-day rules so the heatmap, DM timelines, group chats and the
 * burnout meter agree. All hours are in the viewer's local time zone.
 */

/** Late night = midnight to 4:59am local time. */
export const LATE_NIGHT_START_HOUR = 0;
export const LATE_NIGHT_END_HOUR = 4;

export function isLateNightHour(hour: number): boolean {
  return hour >= LATE_NIGHT_START_HOUR && hour <= LATE_NIGHT_END_HOUR;
}

/** Local hour (0–23) and weekday (0 = Sunday) for a unix-ms timestamp. */
export function localHourAndDay(timestampMs: number): {
  hour: number;
  day: number;
} {
  const d = new Date(timestampMs);
  return { hour: d.getHours(), day: d.getDay() };
}
