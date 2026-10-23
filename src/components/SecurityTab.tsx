"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  AppWindow,
  Clock,
  Key,
  LogIn,
  LogOut,
  Shield,
  ShieldCheck,
  User,
  UserPlus,
} from "lucide-react";
import type { SecurityData, SecurityEvent, SecurityEventType } from "@/types/instagram";
import type { SecurityAuditResult } from "@/types/insights";
import { TAB_INACTIVE, TAB_SELECTED } from "@/lib/tabStyles";
import { formatMonthKey, formatMonthLabel, formatNumber } from "@/lib/formatters";
import {
  describeDevice,
  formatSecurityEventTime,
  resolveSuspiciousLoginAnalysis,
} from "@/lib/securityAnalysis";
import { plural } from "@/lib/profileOwner";
import { usePresentationMode } from "@/contexts/PresentationContext";

interface SecurityTabProps {
  security: SecurityData | null;
  securityAudit?: SecurityAuditResult | null;
}

type TimelineFilter = "all" | "login" | "privacy_change" | "password_change" | "profile_activity";

const PAGE_SIZE = 20;

const EVENT_ICONS: Record<SecurityEventType, typeof LogIn> = {
  login: LogIn,
  logout: LogOut,
  profile_activity: User,
  privacy_change: Shield,
  password_change: Key,
  signup: UserPlus,
  unknown: Clock,
};

const FILTERS: { id: TimelineFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "login", label: "Logins" },
  { id: "privacy_change", label: "Privacy" },
  { id: "password_change", label: "Password" },
  { id: "profile_activity", label: "Profile" },
];

function matchesFilter(event: SecurityEvent, filter: TimelineFilter): boolean {
  if (filter === "all") return true;
  if (filter === "login") return event.type === "login" || event.type === "logout";
  return event.type === filter;
}

/** Logins and account changes as an Instagram notifications feed, grouped by month. */
export function SecurityTab({ security, securityAudit }: SecurityTabProps) {
  const { presentationMode } = usePresentationMode();
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showAllFlagged, setShowAllFlagged] = useState(false);

  const analysis = useMemo(() => (security ? resolveSuspiciousLoginAnalysis(security) : null), [security]);

  const groups = useMemo(() => {
    const events = (security?.events ?? []).filter((e) => matchesFilter(e, filter)).slice(0, visibleCount);
    const byMonth: { key: string; label: string; events: SecurityEvent[] }[] = [];
    for (const event of events) {
      const key = event.timestamp ? formatMonthKey(event.timestamp) : "undated";
      let group = byMonth.find((g) => g.key === key);
      if (!group) {
        group = { key, label: key === "undated" ? "Undated" : formatMonthLabel(key), events: [] };
        byMonth.push(group);
      }
      group.events.push(event);
    }
    return byMonth;
  }, [security?.events, filter, visibleCount]);

  const totalFiltered = useMemo(
    () => (security?.events ?? []).filter((e) => matchesFilter(e, filter)).length,
    [security?.events, filter]
  );

  if (!security) {
    return (
      <div className="py-16 text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-fg">
          <Shield className="h-9 w-9" strokeWidth={1.5} />
        </span>
        <p className="mt-4 text-xl">No security data found</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ig-muted">
          Files from <code>security_and_login_information/</code> weren&apos;t in this export.
        </p>
      </div>
    );
  }

  const flagged = analysis?.flaggedEvents ?? [];
  const shownFlags = showAllFlagged ? flagged : flagged.slice(0, 3);

  return (
    <div className="mx-auto max-w-[614px]">
      <div className="flex items-center gap-3 rounded-xl border border-ig-border p-4">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${flagged.length ? "bg-ig-warn/15 text-ig-warn" : "bg-ig-good/15 text-ig-good"}`}>
          {flagged.length ? <AlertTriangle className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-semibold">
            Security score {analysis?.securityScore ?? securityAudit?.healthScore ?? "—"}/100
          </p>
          <p className="text-sm text-ig-muted">
            {plural(security.loginCount, "login")} ·{" "}
            {flagged.length ? `${plural(flagged.length, "event")} worth a look` : "nothing unusual stood out"}
          </p>
        </div>
      </div>

      {flagged.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-base font-semibold">Worth a look</h2>
          <ul>
            {shownFlags.map((flag) => (
              <li key={`${flag.event.id}-${flag.reason}`} className="flex gap-3 py-2.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ig-warn/15 text-ig-warn">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1 text-sm leading-snug">
                  <p>
                    <span className="font-semibold">{flag.event.label}</span> {flag.reason}
                  </p>
                  <p className="text-xs text-ig-muted">{formatSecurityEventTime(flag.event)}</p>
                </div>
              </li>
            ))}
          </ul>
          {flagged.length > 3 && !showAllFlagged && (
            <button type="button" onClick={() => setShowAllFlagged(true)} className="text-sm font-semibold text-ig-blue hover:text-ig-link">
              See all {flagged.length}
            </button>
          )}
          <p className="mt-2 text-xs text-ig-muted">Flags are a heuristic — they may be totally normal if it was you.</p>
        </section>
      )}

      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => {
              setFilter(f.id);
              setVisibleCount(PAGE_SIZE);
            }}
            className={`shrink-0 ${filter === f.id ? TAB_SELECTED : TAB_INACTIVE}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="py-12 text-center text-sm text-ig-muted">No account events of this kind in your export.</p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="mt-6 border-b border-ig-border pb-3">
            <h2 className="mb-1 text-base font-semibold">{group.label}</h2>
            <ul>
              {group.events.map((event) => (
                <EventRow key={event.id} event={event} hideDetails={presentationMode} />
              ))}
            </ul>
          </section>
        ))
      )}
      {visibleCount < totalFiltered && (
        <button
          type="button"
          onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
          className="mt-4 w-full rounded-lg py-2 text-sm font-semibold text-ig-blue hover:bg-ig-hover"
        >
          Show {formatNumber(Math.min(PAGE_SIZE, totalFiltered - visibleCount))} more
        </button>
      )}

      {securityAudit && securityAudit.connectedApps.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-1 text-base font-semibold">Apps and websites</h2>
          {presentationMode ? (
            <p className="py-2 text-sm text-ig-muted">
              {plural(securityAudit.connectedApps.length, "connected app")} — names hidden while presenting.
            </p>
          ) : (
            <ul>
              {securityAudit.connectedApps.slice(0, 20).map((app) => (
                <li key={app.name} className="flex items-center gap-3 py-2.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ig-secondary">
                    <AppWindow className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{app.name}</span>
                  {app.isStale && <span className="shrink-0 text-xs font-semibold text-ig-warn">Not used lately</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {analysis && analysis.suggestions.length > 0 && (
        <section className="mt-8 rounded-xl bg-ig-secondary p-4">
          <h2 className="text-sm font-semibold">Tips</h2>
          <ul className="mt-2 space-y-1.5 text-sm">
            {analysis.suggestions.map((s) => (
              <li key={s}>• {s}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function EventRow({ event, hideDetails }: { event: SecurityEvent; hideDetails: boolean }) {
  const Icon = EVENT_ICONS[event.type] ?? Clock;
  const details = [
    describeDevice(event.device),
    event.location,
    event.ipAddress && `IP ${event.ipAddress}`,
  ].filter(Boolean);
  return (
    <li className="flex items-center gap-3 py-2">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ig-secondary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 text-sm leading-snug">
        <p className="font-semibold">{event.label}</p>
        {details.length > 0 && (
          <p className="truncate text-xs text-ig-muted">
            {hideDetails ? "Device, location and IP hidden while presenting" : details.join(" · ")}
          </p>
        )}
      </div>
      <span className="shrink-0 text-xs text-ig-muted">{formatSecurityEventTime(event)}</span>
    </li>
  );
}
