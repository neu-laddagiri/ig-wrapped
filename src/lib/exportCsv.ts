import type { InstagramAccount, LinkedInHelperEntry } from "@/types/instagram";
import { formatTimestamp } from "@/lib/formatters";
import {
  linkedInGoogleSearchUrl,
  type LinkedInSearchContext,
} from "@/lib/linkedinSearchQuery";

/** Excel reads a BOM-less CSV as the system code page and garbles non-ASCII. */
const UTF8_BOM = "﻿";

function escapeCsvCell(value: string | undefined | null): string {
  let cell = value ?? "";
  // Neutralize formulas: names and notes can come from other people's profiles.
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  if (/[",\r\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function toCsv(headers: string[], rows: (string | undefined | null)[][]): string {
  return (
    UTF8_BOM +
    [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")
  );
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  // Some browsers ignore clicks on detached anchors or cancel when revoked at once.
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportAccountsCsv(
  accounts: InstagramAccount[],
  filename: string
) {
  const headers = ["username", "href", "timestamp", "follow_date", "category"];
  const rows = accounts.map((a) => [
    a.displayUsername,
    a.href ?? "",
    a.timestamp?.toString() ?? "",
    formatTimestamp(a.timestamp),
    a.category ?? "",
  ]);
  downloadBlob(toCsv(headers, rows), filename, "text/csv;charset=utf-8;");
}

/**
 * `displayLabel` (optional) and `context` let the CSV build the same Google
 * query as the LinkedIn helper's "Search LinkedIn" button.
 */
export function exportLinkedInHelperCsv(
  entries: (LinkedInHelperEntry & { displayLabel?: string })[],
  filename: string,
  context?: LinkedInSearchContext
) {
  const headers = [
    "username",
    "instagram_url",
    "linkedin_search_url",
    "status",
    "notes",
  ];
  const rows = entries.map((e) => [
    e.displayUsername,
    e.instagramHref ?? "",
    linkedInGoogleSearchUrl(
      {
        username: e.username,
        displayName: e.displayUsername,
        displayLabel: e.displayLabel,
      },
      context
    ),
    e.status,
    e.notes,
  ]);
  downloadBlob(toCsv(headers, rows), filename, "text/csv;charset=utf-8;");
}

export function exportSummaryJson(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  downloadBlob(json, filename, "application/json;charset=utf-8;");
}
