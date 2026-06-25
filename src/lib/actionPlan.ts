import type { ParsedExportData } from "@/types/instagram";
import type { InsightsBundle } from "@/types/insights";
import type { DashboardTabId } from "@/components/DashboardTabs";

export type ActionPriority = "high" | "medium" | "low";

export interface ActionPlanItem {
  id: string;
  title: string;
  reason: string;
  priority: ActionPriority;
  tab: DashboardTabId;
  subTab?: string;
}

export function buildActionPlan(
  parsed: ParsedExportData,
  insights: InsightsBundle | null,
  isDemoMode: boolean
): ActionPlanItem[] {
  if (!insights) return [];
  const items: ActionPlanItem[] = [];
  const { network, security, ads } = parsed;

  const highCleanup = insights.cleanup.filter((c) =>
    c.label.toLowerCase().includes("high")
  );
  if (highCleanup.length > 0) {
    items.push({
      id: "cleanup-high",
      title: `Review ${highCleanup.length} high-priority follows`,
      reason: "These accounts score high on cleanup priority based on export signals.",
      priority: "high",
      tab: "cleanup",
    });
  }

  if (network && network.dontFollowMeBack.length > 10) {
    items.push({
      id: "dont-follow-back",
      title: "Audit accounts that don't follow back",
      reason: `${network.dontFollowMeBack.length} accounts you follow without a follow-back.`,
      priority: "medium",
      tab: "network",
    });
  }

  const flagged = security?.suspiciousLoginAnalysis?.flaggedEvents ?? [];
  if (flagged.length > 0) {
    items.push({
      id: "security-review",
      title: "Review flagged security events",
      reason: `${flagged.length} login or security events worth a glance.`,
      priority: "high",
      tab: "security",
    });
  }

  if (ads && ads.advertisersCount > 15) {
    items.push({
      id: "ads-review",
      title: "Review advertisers using your info",
      reason: `${ads.advertisersCount} advertisers detected in your export.`,
      priority: "medium",
      tab: "ads",
    });
  }

  if (network && network.mutuals.length > 5) {
    items.push({
      id: "linkedin",
      title: "Use LinkedIn Helper for mutuals",
      reason: "Track career networking targets from your mutual list.",
      priority: "low",
      tab: "linkedin",
    });
  }

  items.push({
    id: "save-later",
    title: "Save analysis again later",
    reason: "Track changes over time with cloud save.",
    priority: "medium",
    tab: "saved",
  });

  if (!isDemoMode) {
    items.push({
      id: "presentation",
      title: "Enable Presentation Mode before sharing",
      reason: "Hide sensitive names and previews when showing friends or recruiters.",
      priority: "low",
      tab: "overview",
    });
  }

  items.push({
    id: "story-mode",
    title: "Try Story Mode / share cards",
    reason: "Wrapped slideshow and downloadable cards for sharing highlights.",
    priority: "low",
    tab: "overview",
  });

  return items;
}

const DISMISSED_KEY = "igwrapped-dismissed-actions";

export function getDismissedActions(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

export function dismissAction(id: string): void {
  const set = getDismissedActions();
  set.add(id);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set]));
}
