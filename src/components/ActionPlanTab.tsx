"use client";

import { useMemo, useState } from "react";
import { ListChecks, X } from "lucide-react";
import type { ParsedExportData } from "@/types/instagram";
import type { InsightsBundle } from "@/types/insights";
import type { DashboardTabId } from "@/components/DashboardTabs";
import {
  buildActionPlan,
  dismissAction,
  getDismissedActions,
  type ActionPlanItem,
} from "@/lib/actionPlan";

interface ActionPlanTabProps {
  parsed: ParsedExportData;
  insights: InsightsBundle | null;
  isDemoMode: boolean;
  onNavigate: (tab: DashboardTabId) => void;
  /** Scopes dismissals to one export (the file fingerprint). */
  storageKey?: string;
}

const PRIORITY_STYLE = {
  high: "border-red-500/30 bg-red-500/10 text-ig-bad",
  medium: "border-amber-500/30 bg-amber-500/10 text-ig-warn",
  low: "border-ig-border bg-ig-secondary text-ig-muted",
};

export function ActionPlanTab({
  parsed,
  insights,
  isDemoMode,
  onNavigate,
  storageKey,
}: ActionPlanTabProps) {
  const [dismissedState, setDismissedState] = useState(() => ({
    key: storageKey,
    ids: getDismissedActions(storageKey),
  }));
  // Switching exports while mounted: reload that export's dismissals.
  if (dismissedState.key !== storageKey) {
    setDismissedState({ key: storageKey, ids: getDismissedActions(storageKey) });
  }
  const dismissed = dismissedState.ids;
  const items = useMemo(
    () =>
      buildActionPlan(parsed, insights, isDemoMode).filter(
        (i) => !dismissed.has(i.id)
      ),
    [parsed, insights, isDemoMode, dismissed]
  );

  const handleDismiss = (id: string) => {
    dismissAction(id, storageKey);
    setDismissedState((prev) => ({
      key: prev.key,
      ids: new Set(prev.ids).add(id),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-ig-border bg-ig-subtle p-5">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-fg" />
          <h3 className="font-semibold text-fg">Action Plan</h3>
        </div>
        <p className="mt-2 text-sm text-ig-muted">
          Actionable next steps from your parsed export. Dismiss items you have
          handled.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-ig-muted">All caught up — no pending actions.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <ActionRow
              key={item.id}
              item={item}
              onGo={() => onNavigate(item.tab)}
              onDismiss={() => handleDismiss(item.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ActionRow({
  item,
  onGo,
  onDismiss,
}: {
  item: ActionPlanItem;
  onGo: () => void;
  onDismiss: () => void;
}) {
  return (
    <li className="rounded-lg border border-ig-border bg-ig-subtle p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLE[item.priority]}`}
            >
              {item.priority}
            </span>
            <h4 className="font-medium text-fg">{item.title}</h4>
          </div>
          <p className="mt-1.5 text-sm text-ig-muted">{item.reason}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onGo}
            className="rounded-lg animated-gradient-bg px-3 py-1.5 text-xs font-semibold text-white"
          >
            Go
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-ig-border p-1.5 text-ig-muted hover:bg-ig-hover"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
