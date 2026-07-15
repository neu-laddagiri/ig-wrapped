import type { InstagramAccount, LinkedInHelperEntry } from "@/types/instagram";
import { formatTimestamp } from "@/lib/formatters";

export function escapeCsvCell(value: string | number): string {
  const raw = String(value);
  const safe = /^[\t\r]|^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAccountsCsv(
  accounts: InstagramAccount[],
  filename: string
) {
  const headers = ["username", "href", "timestamp", "follow_date", "category"];
  const rows = accounts.map((a) =>
    [
      a.displayUsername,
      a.href ?? "",
      a.timestamp?.toString() ?? "",
      formatTimestamp(a.timestamp),
      a.category ?? "",
    ]
      .map(escapeCsvCell)
      .join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  downloadBlob(csv, filename, "text/csv;charset=utf-8;");
}

export function exportLinkedInHelperCsv(
  entries: LinkedInHelperEntry[],
  filename: string
) {
  const headers = [
    "username",
    "instagram_url",
    "linkedin_search_url",
    "status",
    "notes",
  ];
  const rows = entries.map((e) => {
    const linkedInUrl = `https://www.google.com/search?q=${encodeURIComponent(`site:linkedin.com/in ${e.username}`)}`;
    return [
      e.displayUsername,
      e.instagramHref ?? "",
      linkedInUrl,
      e.status,
      e.notes,
    ]
      .map(escapeCsvCell)
      .join(",");
  });
  const csv = [headers.join(","), ...rows].join("\n");
  downloadBlob(csv, filename, "text/csv;charset=utf-8;");
}

export function exportSummaryJson(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  downloadBlob(json, filename, "application/json;charset=utf-8;");
}
