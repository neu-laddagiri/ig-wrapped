"use client";

import { useState } from "react";
import { Database, ChevronDown, EyeOff } from "lucide-react";
import type {
  DmThreadDebugEntry,
  IdentityResolutionDebug,
  InsightsBundle,
} from "@/types/insights";
import { ConfidencePill } from "@/components/ConfidencePill";
import type { ConfidenceLevel } from "@/types/insights";
import {
  buildAccountIndex,
  resolveAccountIdentity,
} from "@/lib/canonicalAccount";
import type { UnifiedAccount } from "@/types/insights";
import { usePresentationMode } from "@/contexts/PresentationContext";

interface DataExplorerTabProps {
  insights: InsightsBundle | null;
}

function inferConfidence(
  insights: InsightsBundle
): { label: string; level: ConfidenceLevel; note: string }[] {
  const dmThreads = insights.dataExplorer.dmThreadDebug?.length ?? 0;
  const hasNetwork = insights.accounts.length > 0;
  const hasSearch = Boolean(insights.searchWrapped?.totalSearches);
  const hasAds = Boolean(insights.adsInsights);

  const searchWrapped = insights.searchWrapped;
  const searchFiles = searchWrapped?.filesParsed?.length ?? 0;

  return [
    {
      label: "Network data",
      level: hasNetwork && insights.accounts.length > 20 ? "high" : hasNetwork ? "medium" : "low",
      note: hasNetwork ? "Followers/following parsed from export" : "No network files detected",
    },
    {
      label: "DM data",
      level: dmThreads > 5 ? "high" : dmThreads > 0 ? "medium" : "low",
      note:
        dmThreads > 0
          ? `${dmThreads} threads normalized (direct vs group separated)`
          : "No message threads found",
    },
    {
      label: "Search data",
      level: hasSearch ? (searchFiles > 0 ? "high" : "medium") : "low",
      note: hasSearch
        ? `Parsed ${searchFiles} search file(s)`
        : "Search history not in export",
    },
    {
      label: "Ads data",
      level: hasAds ? "medium" : "low",
      note: hasAds ? "Ads & advertisers from export JSON" : "No ads_information files",
    },
  ];
}

export function DataExplorerTab({ insights }: DataExplorerTabProps) {
  const { presentationMode } = usePresentationMode();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  if (!insights) {
    return (
      <div className="rounded-xl border border-ig-border bg-ig-subtle px-6 py-16 text-center">
        <Database className="mx-auto h-10 w-10 text-ig-muted" />
        <p className="mt-4 text-sm text-ig-muted">Upload an export to explore file metadata.</p>
      </div>
    );
  }

  const { dataExplorer, exportCompleteness } = insights;
  const byCategory = new Map<string, number>();
  for (const f of dataExplorer.files) {
    byCategory.set(f.category, (byCategory.get(f.category) ?? 0) + 1);
  }
  const confidence = inferConfidence(insights);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Total files" value={dataExplorer.totalCount} />
        <Stat label="JSON files" value={dataExplorer.jsonCount} />
        <Stat label="Media files" value={dataExplorer.mediaCount} />
        <Stat
          label="Export quality"
          value={`${exportCompleteness.score}/100`}
        />
      </div>

      <div className="rounded-xl border border-ig-border bg-ig-subtle p-5">
        <h3 className="font-semibold text-fg">Data confidence</h3>
        <p className="mt-1 text-xs text-ig-muted">
          How complete each major signal is in this export.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {confidence.map((c) => (
            <div
              key={c.label}
              className="flex items-start justify-between gap-2 rounded-lg border border-ig-border bg-ig-subtle px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg">{c.label}</p>
                <p className="mt-0.5 text-[11px] text-ig-muted">{c.note}</p>
              </div>
              <ConfidencePill level={c.level} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-ig-border bg-ig-subtle p-5">
        <h3 className="font-semibold text-fg">Categories detected</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {[...byCategory.entries()].map(([cat, count]) => (
            <span
              key={cat}
              className="rounded-full border border-ig-border bg-ig-secondary px-3 py-1 text-xs text-fg"
            >
              {cat}: {count}
            </span>
          ))}
        </div>
        {exportCompleteness.missing.length > 0 && (
          <p className="mt-3 text-xs text-ig-muted">
            Missing: {exportCompleteness.missing.join(", ")}
          </p>
        )}
      </div>

      {dataExplorer.leaderboardSources &&
        Object.keys(dataExplorer.leaderboardSources).length > 0 && (
          <div className="rounded-xl border border-ig-border bg-ig-subtle p-5">
            <h3 className="font-semibold text-fg">Leaderboard data sources</h3>
            <p className="mt-1 text-xs text-ig-muted">
              Where account rankings came from.
            </p>
            <ul className="mt-3 space-y-2 text-xs text-ig-muted">
              {Object.entries(dataExplorer.leaderboardSources).map(
                ([id, note]) => (
                  <li key={id} className="rounded-lg border border-ig-border bg-ig-subtle px-3 py-2">
                    <span className="font-medium text-fg">{id}</span>
                    <span className="text-ig-muted"> — {note}</span>
                  </li>
                )
              )}
            </ul>
          </div>
        )}

      {dataExplorer.coreAnalytics && (
        <CoreAnalyticsPanel
          data={dataExplorer.coreAnalytics}
          hideDetails={presentationMode}
        />
      )}

      {dataExplorer.identityResolution && (
        <IdentityResolutionPanel
          debug={dataExplorer.identityResolution}
          hideDetails={presentationMode}
        />
      )}

      {presentationMode ? (
        <div className="flex items-start gap-3 rounded-xl border border-ig-border bg-ig-secondary px-5 py-4">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-fg" />
          <p className="text-sm text-fg">
            Account lookup, identity matches, DM thread diagnostics and file
            paths are hidden in Presentation Mode.
          </p>
        </div>
      ) : (
        <>
          {insights.accounts.length > 0 && (
            <IdentityLookupPanel accounts={insights.accounts} />
          )}

          {dataExplorer.dmThreadDebug &&
            dataExplorer.dmThreadDebug.length > 0 && (
              <DmThreadDebugPanel entries={dataExplorer.dmThreadDebug} />
            )}
        </>
      )}

      <div className="rounded-xl border border-ig-border bg-ig-subtle overflow-hidden">
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          aria-expanded={advancedOpen}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div>
            <h3 className="font-semibold text-fg">Advanced</h3>
            <p className="mt-1 text-xs text-ig-muted">Raw file index</p>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-ig-muted transition ${advancedOpen ? "rotate-180" : ""}`}
          />
        </button>
        {advancedOpen && presentationMode && (
          <p className="border-t border-ig-border px-5 py-4 text-xs text-ig-muted">
            File paths can contain usernames, so the file index is hidden in
            Presentation Mode.
          </p>
        )}
        {advancedOpen && !presentationMode && (
          <div className="border-t border-ig-border px-5 pb-5">
            <div className="mt-4 max-h-96 overflow-y-auto rounded-lg border border-ig-border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-ig-elevated text-ig-muted">
                  <tr>
                    <th className="py-2 pl-3 pr-3">Path</th>
                    <th className="py-2 pr-3">Category</th>
                    <th className="py-2 pr-3">Used</th>
                  </tr>
                </thead>
                <tbody>
                  {dataExplorer.files.slice(0, 200).map((f) => (
                    <tr key={f.path} className="border-t border-ig-border">
                      <td className="max-w-xs truncate py-2 pl-3 pr-3 text-fg">
                        {f.path}
                      </td>
                      <td className="py-2 pr-3 text-ig-muted">{f.category}</td>
                      <td className="py-2 pr-3 text-ig-muted">
                        {f.contributed ? "Yes" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {dataExplorer.files.length > 200 && (
              <p className="mt-2 text-[11px] text-ig-muted">
                Showing the first 200 of {dataExplorer.files.length} indexed
                files.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CoreAnalyticsPanel({
  data,
  hideDetails,
}: {
  data: NonNullable<InsightsBundle["dataExplorer"]["coreAnalytics"]>;
  hideDetails: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const showDetails = expanded && !hideDetails;

  return (
    <div className="rounded-xl border border-ig-border bg-ig-secondary p-5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        disabled={hideDetails}
        aria-expanded={showDetails}
        className="flex w-full items-center justify-between text-left disabled:cursor-default"
      >
        <div>
          <h3 className="font-semibold text-fg">Canonical DM analytics</h3>
          <p className="mt-1 text-xs text-ig-muted">
            {hideDetails
              ? "Per-person rankings hidden in Presentation Mode"
              : "Same normalized threads as the DMs tab — used by leaderboards, Real Ones, LinkedIn"}
          </p>
        </div>
        {!hideDetails && (
          <ChevronDown
            className={`h-5 w-5 text-ig-muted transition ${expanded ? "rotate-180" : ""}`}
          />
        )}
      </button>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Stat label="Direct 1:1 threads" value={data.directDmThreadCount} />
        <Stat label="Group threads" value={data.groupDmThreadCount} />
      </div>

      {showDetails && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ig-muted">
              Top direct DM threads
            </p>
            <ul className="max-h-72 space-y-1 overflow-y-auto text-xs">
              {data.topDirectDmThreads.map((row) => (
                <li
                  key={row.rank}
                  className="flex justify-between rounded-lg border border-ig-border bg-ig-subtle px-3 py-2"
                >
                  <span className="text-fg">{row.name}</span>
                  <span className="tabular-nums text-ig-muted">
                    {row.messageCount.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ig-muted">
              Top people by direct DM
            </p>
            <ul className="max-h-72 space-y-1 overflow-y-auto text-xs">
              {data.topDmPeople.map((row) => (
                <li
                  key={row.rank}
                  className="rounded-lg border border-ig-border bg-ig-subtle px-3 py-2"
                >
                  <p className="text-fg">
                    {row.name}
                    {row.username ? (
                      <span className="text-ig-muted"> @{row.username}</span>
                    ) : null}
                  </p>
                  <p className="text-ig-muted">
                    {row.messageCount.toLocaleString()} msgs
                    {row.matchMethod ? ` · ${row.matchMethod}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ig-muted">
              LinkedIn most interacted (preview)
            </p>
            <ul className="max-h-72 space-y-1 overflow-y-auto text-xs">
              {data.topLinkedInMostInteracted.map((row, i) => (
                <li
                  key={`${row.username}-${i}`}
                  className="rounded-lg border border-ig-border bg-ig-subtle px-3 py-2"
                >
                  <p className="text-fg">{row.name}</p>
                  <p className="text-ig-muted">{row.breakdown}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ig-muted">
              Real Ones score breakdown
            </p>
            <ul className="max-h-72 space-y-1 overflow-y-auto text-xs">
              {data.topRealOnes.map((row, i) => (
                <li
                  key={`${row.username}-${i}`}
                  className="rounded-lg border border-ig-border bg-ig-subtle px-3 py-2"
                >
                  <p className="text-fg">
                    {row.name}{" "}
                    <span className="text-fg">({row.score})</span>
                  </p>
                  <p className="text-ig-muted">{row.breakdown}</p>
                </li>
              ))}
            </ul>
          </div>
          {data.validation && (
            <div className="lg:col-span-2 rounded-lg border border-ig-border bg-ig-subtle p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ig-muted">
                Consistency checks
              </p>
              <ul className="space-y-1 text-xs text-fg">
                <li>
                  DMs tab ↔ Leaderboards top DM:{" "}
                  {data.validation.dmLeaderboardParityOk ? (
                    <span className="text-ig-good">OK</span>
                  ) : (
                    <span className="text-ig-warn">Mismatch</span>
                  )}
                </li>
                <li>
                  Export owner identity: {data.validation.ownerIdentityConfidence}
                </li>
                {data.validation.ownerIdentityDisplayNames &&
                  data.validation.ownerIdentityDisplayNames.length > 0 && (
                    <li>
                      Detected you:{" "}
                      {data.validation.ownerIdentityDisplayNames.join(", ")}
                    </li>
                  )}
                {data.validation.ownerIdentitySources &&
                  data.validation.ownerIdentitySources.length > 0 && (
                    <li className="text-ig-muted">
                      Owner sources: {data.validation.ownerIdentitySources.join(" · ")}
                    </li>
                  )}
                <li>
                  Blocked list in export:{" "}
                  {data.validation.blockedIncluded ? "yes" : "not included"}
                </li>
                <li>
                  Restricted list in export:{" "}
                  {data.validation.restrictedIncluded ? "yes" : "not included"}
                </li>
              </ul>
              {data.validation.dmLeaderboardParityNotes.length > 0 && (
                <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-ig-warn">
                  {data.validation.dmLeaderboardParityNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IdentityResolutionPanel({
  debug,
  hideDetails,
}: {
  debug: IdentityResolutionDebug;
  hideDetails: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const showDetails = expanded && !hideDetails;

  return (
    <div className="rounded-xl border border-ig-border bg-ig-secondary p-5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        disabled={hideDetails}
        aria-expanded={showDetails}
        className="flex w-full items-center justify-between text-left disabled:cursor-default"
      >
        <div>
          <h3 className="font-semibold text-fg">Identity resolution</h3>
          <p className="mt-1 text-xs text-ig-muted">
            {hideDetails
              ? "Matched names hidden in Presentation Mode"
              : "How network accounts are matched to DM threads and interactions"}
          </p>
        </div>
        {!hideDetails && (
          <ChevronDown
            className={`h-5 w-5 text-ig-muted transition ${expanded ? "rotate-180" : ""}`}
          />
        )}
      </button>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Canonical people" value={debug.totalCanonicalPeople} />
        <Stat label="Network only" value={debug.networkOnlyPeople} />
        <Stat label="DM matched" value={debug.directDmMatchedPeople} />
        <Stat label="Possible DM" value={debug.possibleDmMatches} />
        <Stat label="Unmatched threads" value={debug.unmatchedDmThreads} />
      </div>

      {showDetails && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ig-muted">
              Top direct DM matches
            </p>
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {debug.topMatches.map((row, i) => (
                <li
                  key={`${row.username ?? row.resolvedName}-${i}`}
                  className="rounded-lg border border-ig-border bg-ig-subtle px-3 py-2 text-xs"
                >
                  <p className="font-medium text-fg">
                    {row.resolvedName}
                    {row.username ? (
                      <span className="text-ig-muted"> @{row.username}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-ig-muted">
                    {row.messageCount.toLocaleString()} msgs · {row.matchMethod}{" "}
                    · {row.confidence}
                  </p>
                  {row.threadTitle && (
                    <p className="text-ig-muted">Thread: {row.threadTitle}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ig-muted">
              Unmatched DM threads
            </p>
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {debug.topUnmatched.length === 0 ? (
                <li className="text-xs text-ig-muted">All direct threads matched.</li>
              ) : (
                debug.topUnmatched.map((row) => (
                  <li
                    key={row.threadId}
                    className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2 text-xs"
                  >
                    <p className="font-medium text-fg">{row.title}</p>
                    <p className="mt-1 text-ig-muted">
                      {row.messageCount.toLocaleString()} msgs
                      {row.folderSlug ? ` · folder: ${row.folderSlug}` : ""}
                    </p>
                    {row.participants.length > 0 && (
                      <p className="text-ig-muted">
                        Participants: {row.participants.slice(0, 3).join(", ")}
                      </p>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-ig-border bg-ig-subtle p-4">
      <p className="text-xs text-ig-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-fg">{value}</p>
    </div>
  );
}

function DmThreadDebugPanel({ entries }: { entries: DmThreadDebugEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const [showCount, setShowCount] = useState(15);

  return (
    <div className="rounded-xl border border-ig-border bg-ig-subtle p-5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h3 className="font-semibold text-fg">Parser diagnostics</h3>
          <p className="mt-1 text-xs text-ig-muted">
            {entries.length} threads — verify direct vs group attribution
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-ig-muted transition ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
          {entries.slice(0, showCount).map((t) => (
            <div
              key={t.threadId}
              className="rounded-lg border border-ig-border bg-ig-subtle p-3 text-xs"
            >
              <p className="font-medium text-fg">{t.title}</p>
              <p className="mt-1 text-ig-muted">
                {t.isGroup ? "Group" : "1-on-1"} · {t.participantCount} people ·{" "}
                {t.totalMessages} msgs · confidence {t.nameConfidence}
              </p>
              {t.inferredOtherParticipant && (
                <p className="text-ig-muted">
                  Other: {t.inferredOtherParticipant}
                  {t.isUnknownAccount ? " (unknown/deleted)" : ""}
                </p>
              )}
              <p className="mt-1 text-ig-muted">
                Direct board: {t.contributesToDirectLeaderboard ? "yes" : "no"} ·
                Group board: {t.contributesToGroupLeaderboard ? "yes" : "no"}
              </p>
              {t.sourcePath && (
                <p className="mt-1 truncate text-ig-muted">{t.sourcePath}</p>
              )}
            </div>
          ))}
          {showCount < entries.length && (
            <button
              type="button"
              onClick={() => setShowCount((n) => n + 25)}
              className="text-xs text-ig-blue hover:underline"
            >
              Show more threads
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function IdentityLookupPanel({ accounts }: { accounts: UnifiedAccount[] }) {
  const [query, setQuery] = useState("");
  const index = buildAccountIndex(accounts);
  const resolved = query.trim()
    ? resolveAccountIdentity(index, query.trim())
    : undefined;
  const unified = resolved
    ? accounts.find(
        (a) =>
          a.username === resolved.username ||
          a.displayName === resolved.displayName
      )
    : undefined;

  return (
    <div className="rounded-xl border border-ig-border bg-ig-secondary p-5">
      <h3 className="font-semibold text-fg">Account identity lookup</h3>
      <p className="mt-1 text-xs text-ig-muted">
        Search any username or display name — same resolver used by receipts, leaderboards, and LinkedIn.
      </p>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g. a username or display name"
        aria-label="Search accounts by username or display name"
        className="mt-3 w-full rounded-lg border border-ig-border bg-ig-subtle px-4 py-2.5 text-sm text-fg placeholder:text-ig-muted"
      />

      {resolved && (
        <div className="mt-4 space-y-3 rounded-lg border border-ig-border bg-ig-subtle p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-fg">{resolved.displayName}</p>
            <ConfidencePill level={resolved.confidence as ConfidenceLevel} />
          </div>
          <p className="text-ig-muted">
            Username: <span className="text-fg">{resolved.username}</span> ·
            Stable key: <span className="text-fg">{resolved.stableKey}</span>
          </p>
          <p className="text-ig-muted">
            Aliases:{" "}
            <span className="text-fg">
              {(unified?.aliases ?? resolved.aliases).slice(0, 12).join(", ") ||
                "—"}
            </span>
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Stat label="Direct DMs" value={resolved.dmStats.directCount} />
            <Stat
              label="Sent by you / them"
              value={
                resolved.dmStats.senderSplitAvailable
                  ? `${resolved.dmStats.sentByMe ?? 0} / ${resolved.dmStats.sentByThem ?? 0}`
                  : "unavailable"
              }
            />
            <Stat label="Likes" value={resolved.interactionStats.likes} />
            <Stat label="Comments" value={resolved.interactionStats.comments} />
            <Stat label="Story interactions" value={resolved.interactionStats.stories} />
            <Stat
              label="DM match"
              value={resolved.dmStats.matchMethod?.replace(/-/g, " ") ?? "—"}
            />
          </div>
          <p className="text-ig-muted">
            Likes: {resolved.interactionStats.likesAttribution ?? "—"} · Comments:{" "}
            {resolved.interactionStats.commentsAttribution ?? "—"} · Stories:{" "}
            {resolved.interactionStats.storiesAttribution ?? "—"}
          </p>
          {unified?.dmThreadId && (
            <p className="text-ig-muted">DM thread ID: {unified.dmThreadId}</p>
          )}
          {unified?.dataSourceNotes && unified.dataSourceNotes.length > 0 && (
            <ul className="space-y-1 text-ig-muted">
              {unified.dataSourceNotes.map((note) => (
                <li key={note}>· {note}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {query.trim() && !resolved && (
        <p className="mt-3 text-xs text-ig-warn">
          No canonical account matched &quot;{query.trim()}&quot;.
        </p>
      )}
    </div>
  );
}
