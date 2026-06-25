import { format, fromUnixTime, isValid, parseISO } from "date-fns";

export function formatNumber(n: number): string {
  return n.toLocaleString();
}

export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(1)}%`;
}

export function parseTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? Math.floor(value / 1000) : value;
  }
  if (typeof value === "string" && value.trim()) {
    const asNum = Number(value);
    if (Number.isFinite(asNum)) {
      return asNum > 1e12 ? Math.floor(asNum / 1000) : asNum;
    }
    const parsed = parseISO(value);
    if (isValid(parsed)) return Math.floor(parsed.getTime() / 1000);
  }
  return undefined;
}

export function formatTimestamp(ts?: number): string {
  if (!ts) return "—";
  try {
    const date = fromUnixTime(ts);
    if (!isValid(date)) return "—";
    return format(date, "MMM d, yyyy");
  } catch {
    return "—";
  }
}

export function formatMonthKey(ts: number): string {
  try {
    return format(fromUnixTime(ts), "yyyy-MM");
  } catch {
    return "unknown";
  }
}

export function formatMonthLabel(monthKey: string): string {
  try {
    const date = parseISO(`${monthKey}-01`);
    if (!isValid(date)) return monthKey;
    return format(date, "MMMM yyyy");
  } catch {
    return monthKey;
  }
}

import {
  buildLinkedInSearchQuery,
  linkedInGoogleSearchUrl,
  type LinkedInSearchContext,
} from "@/lib/linkedinSearchQuery";

export function linkedInSearchUrl(
  username: string,
  displayName?: string,
  context?: string
): string {
  return linkedInGoogleSearchUrl(
    { username, displayName },
    context ? { school: context } : undefined
  );
}

export { buildLinkedInSearchQuery, linkedInGoogleSearchUrl };
export type { LinkedInSearchContext };

export function instagramProfileUrl(username: string): string {
  return `https://www.instagram.com/${encodeURIComponent(username)}/`;
}

export function normalizeUsername(username: string): string {
  return username.trim().replace(/^@/, "").toLowerCase();
}
