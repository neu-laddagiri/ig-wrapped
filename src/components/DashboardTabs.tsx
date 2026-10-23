/**
 * Dashboard routes. The app is laid out like Instagram: a feed, profile,
 * messages and notifications, with the data tools tucked under "More".
 */
export type DashboardTabId =
  | "home"
  | "search"
  | "explore"
  | "messages"
  | "activity"
  | "profile"
  | "people"
  | "saved"
  | "eras"
  | "network"
  | "linkedin"
  | "explorer"
  | "export"
  | "compare"
  | "actionplan";

const TAB_IDS = new Set<string>([
  "home",
  "search",
  "explore",
  "messages",
  "activity",
  "profile",
  "people",
  "saved",
  "eras",
  "network",
  "linkedin",
  "explorer",
  "export",
  "compare",
  "actionplan",
]);

/** Tab ids from before the Instagram layout, as stored in older cloud saves. */
const LEGACY_TABS: Record<string, DashboardTabId> = {
  overview: "home",
  wrapped: "home",
  funstats: "home",
  personality: "profile",
  yearbook: "profile",
  social: "people",
  cleanup: "people",
  realones: "people",
  dms: "messages",
  groups: "messages",
  ads: "explore",
  security: "activity",
};

export function normalizeTabId(raw: unknown): DashboardTabId {
  if (typeof raw !== "string") return "home";
  if (TAB_IDS.has(raw)) return raw as DashboardTabId;
  return LEGACY_TABS[raw] ?? "home";
}

/** Data tools reached from the More menu rather than the main nav. */
export const TOOL_TABS: {
  id: DashboardTabId;
  label: string;
  description: string;
}[] = [
  { id: "actionplan", label: "Action plan", description: "A short checklist from your export" },
  { id: "linkedin", label: "LinkedIn helper", description: "Find mutuals on LinkedIn, by hand" },
  { id: "compare", label: "Compare exports", description: "What changed between two saves" },
  { id: "export", label: "Download CSVs", description: "Your lists as spreadsheets" },
  { id: "explorer", label: "Data explorer", description: "Every file in your export" },
];

/** Sections that live on the profile page and share its header. */
export const PROFILE_TABS = new Set<DashboardTabId>(["profile", "people", "saved"]);
