"use client";

import { useMemo, useState } from "react";
import {
  LogIn,
  LogOut,
  User,
  Shield,
  Key,
  AlertTriangle,
  Clock,
  UserPlus,
  MapPin,
  Monitor,
  ChevronDown,
} from "lucide-react";
import type {
  SecurityData,
  SecurityEvent,
  SecurityEventType,
} from "@/types/instagram";
import type { SecurityAuditResult } from "@/types/insights";
import { SummaryCard } from "@/components/SummaryCard";
import { formatNumber } from "@/lib/formatters";
import {
  formatSecurityEventTime,
  resolveSuspiciousLoginAnalysis,
} from "@/lib/securityAnalysis";

interface SecurityTabProps {
  security: SecurityData | null;
  securityAudit?: SecurityAuditResult | null;
}

type TimelineFilter =
  | "all"
  | "login"
  | "privacy_change"
  | "password_change"
  | "profile_activity";

const PAGE_SIZE = 8;
const FLAGGED_INITIAL = 3;

const EVENT_ICONS: Record<SecurityEventType, typeof LogIn> = {
  login: LogIn,
  logout: LogOut,
  profile_activity: User,
  privacy_change: Shield,
  password_change: Key,
  signup: UserPlus,
  unknown: Clock,
};

const EVENT_COLORS: Record<SecurityEventType, string> = {
  login: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  logout: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  profile_activity: "text-pink-400 border-pink-500/30 bg-pink-500/10",
  privacy_change: "text-purple-400 border-purple-500/30 bg-purple-500/10",
  password_change: "text-orange-400 border-orange-500/30 bg-orange-500/10",
  signup: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  unknown: "text-white/50 border-white/20 bg-white/5",
};

function matchesFilter(event: SecurityEvent, filter: TimelineFilter): boolean {
  if (filter === "all") return true;
  if (filter === "login") return event.type === "login" || event.type === "logout";
  return event.type === filter;
}

function TimelineEventRow({ event }: { event: SecurityEvent }) {
  const Icon = EVENT_ICONS[event.type] ?? Clock;
  const color = EVENT_COLORS[event.type] ?? EVENT_COLORS.unknown;

  return (
    <li className="flex gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${color}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-medium text-white">{event.label}</p>
          <span className="text-xs text-white/40">
            {formatSecurityEventTime(event)}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/45">
          {event.device && (
            <span className="inline-flex items-center gap-1">
              <Monitor className="h-3 w-3" />
              {event.device}
            </span>
          )}
          {event.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {event.location}
            </span>
          )}
          {event.ipAddress && (
            <span className="text-white/35">IP: {event.ipAddress}</span>
          )}
        </div>
      </div>
    </li>
  );
}

export function SecurityTab({ security, securityAudit }: SecurityTabProps) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showAllFlagged, setShowAllFlagged] = useState(false);

  const analysis = useMemo(
    () => (security ? resolveSuspiciousLoginAnalysis(security) : null),
    [security]
  );

  const filteredEvents = useMemo(() => {
    const events = security?.events ?? [];
    return events.filter((e) => matchesFilter(e, filter));
  }, [security?.events, filter]);

  const visibleEvents = filteredEvents.slice(0, visibleCount);

  if (!security) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
        <Shield className="mx-auto h-10 w-10 text-white/20" />
        <h3 className="mt-4 text-lg font-semibold text-white">
          No security data found
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
          Security files from{" "}
          <code className="text-white/60">security_and_login_information/</code>{" "}
          were not detected.
        </p>
      </div>
    );
  }

  const filters: { id: TimelineFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "login", label: "Logins" },
    { id: "privacy_change", label: "Privacy changes" },
    { id: "password_change", label: "Password changes" },
    { id: "profile_activity", label: "Profile activity" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          label="Logins"
          value={formatNumber(security.loginCount)}
          icon={LogIn}
          accent="green"
        />
        <SummaryCard
          label="Logouts"
          value={formatNumber(security.logoutCount)}
          icon={LogOut}
          accent="blue"
        />
        <SummaryCard
          label="Profile activity"
          value={formatNumber(security.profileActivityCount)}
          icon={User}
          accent="pink"
        />
        <SummaryCard
          label="Privacy changes"
          value={formatNumber(security.privacyChangeCount)}
          icon={Shield}
          accent="purple"
        />
        <SummaryCard
          label="Password changes"
          value={formatNumber(security.passwordChangeCount)}
          icon={Key}
          accent="orange"
        />
      </div>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-[#515BD4]" />
          <h3 className="font-semibold text-white">Account timeline</h3>
        </div>
        <p className="mt-1 text-xs text-white/40">
          Latest events from your export. Worth reviewing if something looks unfamiliar.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFilter(f.id);
                setVisibleCount(PAGE_SIZE);
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === f.id
                  ? "animated-gradient-bg text-white"
                  : "border border-white/10 bg-white/5 text-white/55 hover:text-white/75"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredEvents.length > 0 ? (
          <>
            <ul className="mt-4 space-y-2">
              {visibleEvents.map((event) => (
                <TimelineEventRow key={event.id} event={event} />
              ))}
            </ul>
            {visibleCount < filteredEvents.length && (
              <button
                type="button"
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[#DD2A7B] hover:underline"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Show more timeline events ({filteredEvents.length - visibleCount} remaining)
              </button>
            )}
          </>
        ) : (
          <p className="mt-4 text-sm text-white/45">
            No detailed timeline events found in this export.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-400/90" />
          <h3 className="font-semibold text-white">Login & activity review</h3>
        </div>
        <p className="mt-1 text-xs text-white/40">
          Heuristic review only — flagged items could be normal if this was you.
        </p>

        {analysis ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/40">
                  Security score
                </p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {analysis.securityScore}/100
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/40">
                  Events reviewed
                </p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {formatNumber(analysis.eventsReviewed)}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="text-[10px] uppercase tracking-wider text-white/40">
                  Worth reviewing
                </p>
                <p className="mt-1 text-2xl font-bold text-amber-200">
                  {formatNumber(analysis.worthReviewingCount)}
                </p>
              </div>
            </div>

            {analysis.flaggedEvents.length > 0 ? (
              <>
              <ul className="space-y-2">
                {(showAllFlagged
                  ? analysis.flaggedEvents
                  : analysis.flaggedEvents.slice(0, FLAGGED_INITIAL)
                ).map((flag) => (
                  <li
                    key={`${flag.event.id}-${flag.reason}`}
                    className={`rounded-xl border p-3 text-sm ${
                      flag.severity === "high"
                        ? "border-amber-500/25 bg-amber-500/8 text-amber-100/90"
                        : flag.severity === "medium"
                          ? "border-white/15 bg-white/[0.04] text-white/75"
                          : "border-white/10 bg-white/[0.03] text-white/65"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{flag.event.label}</span>
                      <span className="text-xs opacity-70">
                        {formatSecurityEventTime(flag.event)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed opacity-90">
                      {flag.reason}
                    </p>
                  </li>
                ))}
              </ul>
              {analysis.flaggedEvents.length > FLAGGED_INITIAL && !showAllFlagged && (
                <button
                  type="button"
                  onClick={() => setShowAllFlagged(true)}
                  className="mt-3 text-xs font-medium text-[#DD2A7B] hover:underline"
                >
                  Show all flagged items ({analysis.flaggedEvents.length})
                </button>
              )}
              </>
            ) : (
              <p className="text-sm text-white/60">
                No unusual patterns detected. Still worth reviewing login history periodically.
              </p>
            )}

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                Suggested actions
              </p>
              <ul className="mt-2 space-y-1.5">
                {analysis.suggestions.map((s) => (
                  <li key={s} className="text-xs text-white/60">
                    • {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-amber-100/70">
            Not enough security event detail to run the checker on this export.
          </p>
        )}
      </div>

      {securityAudit && securityAudit.connectedApps.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h3 className="font-semibold text-white">Connected apps</h3>
          <p className="mt-1 text-xs text-white/40">
            Apps and websites connected to your Instagram account.
          </p>
          <ul className="mt-4 space-y-2">
            {securityAudit.connectedApps.slice(0, 20).map((app) => (
              <li
                key={app.name}
                className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-sm"
              >
                <span className="text-white/75">{app.name}</span>
                {app.isStale && (
                  <span className="text-xs text-amber-400/80">Stale</span>
                )}
              </li>
            ))}
          </ul>
          {securityAudit.staleApps.length > 0 && (
            <p className="mt-3 text-xs text-white/40">
              {securityAudit.staleApps.length} app(s) may be worth disconnecting.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
