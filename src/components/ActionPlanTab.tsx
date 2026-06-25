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
}

const PRIORITY_STYLE = {
  high: "border-red-500/30 bg-red-500/10 text-red-200",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  low: "border-white/15 bg-white/5 text-white/50",
};

export function ActionPlanTab({
  parsed,
  insights,
  isDemoMode,
  onNavigate,
}: ActionPlanTabProps) {
  const [dismissed, setDismissed] = useState(() => getDismissedActions());
  const items = useMemo(
    () =>
      buildActionPlan(parsed, insights, isDemoMode).filter(
        (i) => !dismissed.has(i.id)
      ),
    [parsed, insights, isDemoMode, dismissed]
  );

  const handleDismiss = (id: string) => {
    dismissAction(id);
    setDismissed(getDismissedActions());
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <div className="flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-[#DD2A7B]" />
          <h3 className="font-semibold text-white">Action Plan</h3>
        </div>
        <p className="mt-2 text-sm text-white/50">
          Actionable next steps from your parsed export. Dismiss items you have
          handled.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-white/40">All caught up — no pending actions.</p>
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
    <li className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLE[item.priority]}`}
            >
              {item.priority}
            </span>
            <h4 className="font-medium text-white">{item.title}</h4>
          </div>
          <p className="mt-1.5 text-sm text-white/45">{item.reason}</p>
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
            className="rounded-lg border border-white/10 p-1.5 text-white/40 hover:bg-white/5"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
