"use client";

import { useState } from "react";
import { Database, AlertTriangle, ChevronDown } from "lucide-react";
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
  const [showRaw, setShowRaw] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  if (!insights) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
        <Database className="mx-auto h-10 w-10 text-white/20" />
        <p className="mt-4 text-sm text-white/45">Upload an export to explore file metadata.</p>
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

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h3 className="font-semibold text-white">Data confidence</h3>
        <p className="mt-1 text-xs text-white/40">
          How complete each major signal is in this export.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {confidence.map((c) => (
            <div
              key={c.label}
              className="flex items-start justify-between gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/80">{c.label}</p>
                <p className="mt-0.5 text-[11px] text-white/40">{c.note}</p>
              </div>
              <ConfidencePill level={c.level} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h3 className="font-semibold text-white">Categories detected</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {[...byCategory.entries()].map(([cat, count]) => (
            <span
              key={cat}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65"
            >
              {cat}: {count}
            </span>
          ))}
        </div>
        {exportCompleteness.missing.length > 0 && (
          <p className="mt-3 text-xs text-white/40">
            Missing: {exportCompleteness.missing.join(", ")}
          </p>
        )}
      </div>

      {dataExplorer.leaderboardSources &&
        Object.keys(dataExplorer.leaderboardSources).length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <h3 className="font-semibold text-white">Leaderboard data sources</h3>
            <p className="mt-1 text-xs text-white/40">
              Where account rankings came from.
            </p>
            <ul className="mt-3 space-y-2 text-xs text-white/55">
              {Object.entries(dataExplorer.leaderboardSources).map(
                ([id, note]) => (
                  <li key={id} className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                    <span className="font-medium text-white/70">{id}</span>
                    <span className="text-white/40"> — {note}</span>
                  </li>
                )
              )}
            </ul>
          </div>
        )}

      {dataExplorer.coreAnalytics && (
        <CoreAnalyticsPanel data={dataExplorer.coreAnalytics} />
      )}

      {dataExplorer.identityResolution && (
        <IdentityResolutionPanel debug={dataExplorer.identityResolution} />
      )}

      {insights.accounts.length > 0 && (
        <IdentityLookupPanel accounts={insights.accounts} />
      )}

      {dataExplorer.dmThreadDebug && dataExplorer.dmThreadDebug.length > 0 && (
        <DmThreadDebugPanel entries={dataExplorer.dmThreadDebug} />
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden">
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div>
            <h3 className="font-semibold text-white">Advanced</h3>
            <p className="mt-1 text-xs text-white/40">
              Raw file index and JSON preview
            </p>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-white/40 transition ${advancedOpen ? "rotate-180" : ""}`}
          />
        </button>
        {advancedOpen && (
          <div className="border-t border-white/8 px-5 pb-5">
            <div className="mt-4 max-h-96 overflow-y-auto rounded-xl border border-white/8">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#0a0a10] text-white/40">
                  <tr>
                    <th className="py-2 pl-3 pr-3">Path</th>
                    <th className="py-2 pr-3">Category</th>
                    <th className="py-2 pr-3">Used</th>
                  </tr>
                </thead>
                <tbody>
                  {dataExplorer.files.slice(0, 200).map((f) => (
                    <tr key={f.path} className="border-t border-white/5">
                      <td className="max-w-xs truncate py-2 pl-3 pr-3 text-white/60">
                        {f.path}
                      </td>
                      <td className="py-2 pr-3 text-white/45">{f.category}</td>
                      <td className="py-2 pr-3 text-white/40">
                        {f.contributed ? "Yes" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm text-white/55">
              <input
                type="checkbox"
                checked={showRaw}
                onChange={(e) => setShowRaw(e.target.checked)}
                className="accent-[#DD2A7B]"
              />
              Show raw JSON preview
            </label>
            {showRaw && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100/80">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Raw JSON may contain private content. Use the file index for
                transparency without exposing message bodies.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CoreAnalyticsPanel({
  data,
}: {
  data: NonNullable<InsightsBundle["dataExplorer"]["coreAnalytics"]>;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-[#DD2A7B]/20 bg-[#DD2A7B]/5 p-5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h3 className="font-semibold text-white">Canonical DM analytics</h3>
          <p className="mt-1 text-xs text-white/40">
            Same normalized threads as the DMs tab — used by leaderboards, Real Ones, LinkedIn
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-white/40 transition ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Stat label="Direct 1:1 threads" value={data.directDmThreadCount} />
        <Stat label="Group threads" value={data.groupDmThreadCount} />
      </div>

      {expanded && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              Top direct DM threads
            </p>
            <ul className="max-h-72 space-y-1 overflow-y-auto text-xs">
              {data.topDirectDmThreads.map((row) => (
                <li
                  key={row.rank}
                  className="flex justify-between rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2"
                >
                  <span className="text-white/75">{row.name}</span>
                  <span className="tabular-nums text-white/45">
                    {row.messageCount.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              Top people by direct DM
            </p>
            <ul className="max-h-72 space-y-1 overflow-y-auto text-xs">
              {data.topDmPeople.map((row) => (
                <li
                  key={row.rank}
                  className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2"
                >
                  <p className="text-white/75">
                    {row.name}
                    {row.username ? (
                      <span className="text-white/35"> @{row.username}</span>
                    ) : null}
                  </p>
                  <p className="text-white/40">
                    {row.messageCount.toLocaleString()} msgs
                    {row.matchMethod ? ` · ${row.matchMethod}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              LinkedIn most interacted (preview)
            </p>
            <ul className="max-h-72 space-y-1 overflow-y-auto text-xs">
              {data.topLinkedInMostInteracted.map((row, i) => (
                <li
                  key={`${row.username}-${i}`}
                  className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2"
                >
                  <p className="text-white/75">{row.name}</p>
                  <p className="text-white/40">{row.breakdown}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              Real Ones score breakdown
            </p>
            <ul className="max-h-72 space-y-1 overflow-y-auto text-xs">
              {data.topRealOnes.map((row, i) => (
                <li
                  key={`${row.username}-${i}`}
                  className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2"
                >
                  <p className="text-white/75">
                    {row.name}{" "}
                    <span className="text-[#DD2A7B]">({row.score})</span>
                  </p>
                  <p className="text-white/40">{row.breakdown}</p>
                </li>
              ))}
            </ul>
          </div>
          {data.validation && (
            <div className="lg:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                Consistency checks
              </p>
              <ul className="space-y-1 text-xs text-white/60">
                <li>
                  DMs tab ↔ Leaderboards top DM:{" "}
                  {data.validation.dmLeaderboardParityOk ? (
                    <span className="text-emerald-400">OK</span>
                  ) : (
                    <span className="text-amber-400">Mismatch</span>
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
                    <li className="text-white/45">
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
                <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-amber-300/80">
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

function IdentityResolutionPanel({ debug }: { debug: IdentityResolutionDebug }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-[#515BD4]/20 bg-[#515BD4]/5 p-5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h3 className="font-semibold text-white">Identity resolution</h3>
          <p className="mt-1 text-xs text-white/40">
            How network accounts are matched to DM threads and interactions
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-white/40 transition ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Canonical people" value={debug.totalCanonicalPeople} />
        <Stat label="Network only" value={debug.networkOnlyPeople} />
        <Stat label="DM matched" value={debug.directDmMatchedPeople} />
        <Stat label="Possible DM" value={debug.possibleDmMatches} />
        <Stat label="Unmatched threads" value={debug.unmatchedDmThreads} />
      </div>

      {expanded && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              Top direct DM matches
            </p>
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {debug.topMatches.map((row, i) => (
                <li
                  key={`${row.username ?? row.resolvedName}-${i}`}
                  className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-xs"
                >
                  <p className="font-medium text-white">
                    {row.resolvedName}
                    {row.username ? (
                      <span className="text-white/40"> @{row.username}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-white/45">
                    {row.messageCount.toLocaleString()} msgs · {row.matchMethod}{" "}
                    · {row.confidence}
                  </p>
                  {row.threadTitle && (
                    <p className="text-white/35">Thread: {row.threadTitle}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
              Unmatched DM threads
            </p>
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {debug.topUnmatched.length === 0 ? (
                <li className="text-xs text-white/40">All direct threads matched.</li>
              ) : (
                debug.topUnmatched.map((row) => (
                  <li
                    key={row.threadId}
                    className="rounded-xl border border-amber-500/15 bg-amber-500/5 px-3 py-2 text-xs"
                  >
                    <p className="font-medium text-white/80">{row.title}</p>
                    <p className="mt-1 text-white/45">
                      {row.messageCount.toLocaleString()} msgs
                      {row.folderSlug ? ` · folder: ${row.folderSlug}` : ""}
                    </p>
                    {row.participants.length > 0 && (
                      <p className="text-white/35">
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
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs text-white/40">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function DmThreadDebugPanel({ entries }: { entries: DmThreadDebugEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const [showCount, setShowCount] = useState(15);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h3 className="font-semibold text-white">Parser diagnostics</h3>
          <p className="mt-1 text-xs text-white/40">
            {entries.length} threads — verify direct vs group attribution
          </p>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-white/40 transition ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && (
        <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
          {entries.slice(0, showCount).map((t) => (
            <div
              key={t.threadId}
              className="rounded-xl border border-white/8 bg-white/[0.03] p-3 text-xs"
            >
              <p className="font-medium text-white/80">{t.title}</p>
              <p className="mt-1 text-white/40">
                {t.isGroup ? "Group" : "1-on-1"} · {t.participantCount} people ·{" "}
                {t.totalMessages} msgs · confidence {t.nameConfidence}
              </p>
              {t.inferredOtherParticipant && (
                <p className="text-white/50">
                  Other: {t.inferredOtherParticipant}
                  {t.isUnknownAccount ? " (unknown/deleted)" : ""}
                </p>
              )}
              <p className="mt-1 text-white/35">
                Direct board: {t.contributesToDirectLeaderboard ? "yes" : "no"} ·
                Group board: {t.contributesToGroupLeaderboard ? "yes" : "no"}
              </p>
              {t.sourcePath && (
                <p className="mt-1 truncate text-white/30">{t.sourcePath}</p>
              )}
            </div>
          ))}
          {showCount < entries.length && (
            <button
              type="button"
              onClick={() => setShowCount((n) => n + 25)}
              className="text-xs text-[#DD2A7B] hover:underline"
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
    <div className="rounded-2xl border border-[#8134AF]/20 bg-[#8134AF]/5 p-5">
      <h3 className="font-semibold text-white">Account identity lookup</h3>
      <p className="mt-1 text-xs text-white/40">
        Search any username or display name — same resolver used by receipts, leaderboards, and LinkedIn.
      </p>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g. levinpunnoose or Corey"
        className="mt-3 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-white/30"
      />

      {resolved && (
        <div className="mt-4 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-white">{resolved.displayName}</p>
            <ConfidencePill level={resolved.confidence as ConfidenceLevel} />
          </div>
          <p className="text-white/45">
            Username: <span className="text-white/70">{resolved.username}</span> ·
            Stable key: <span className="text-white/70">{resolved.stableKey}</span>
          </p>
          <p className="text-white/45">
            Aliases:{" "}
            <span className="text-white/60">
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
          <p className="text-white/40">
            Likes: {resolved.interactionStats.likesAttribution ?? "—"} · Comments:{" "}
            {resolved.interactionStats.commentsAttribution ?? "—"} · Stories:{" "}
            {resolved.interactionStats.storiesAttribution ?? "—"}
          </p>
          {unified?.dmThreadId && (
            <p className="text-white/35">DM thread ID: {unified.dmThreadId}</p>
          )}
          {unified?.dataSourceNotes && unified.dataSourceNotes.length > 0 && (
            <ul className="space-y-1 text-white/40">
              {unified.dataSourceNotes.map((note) => (
                <li key={note}>· {note}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {query.trim() && !resolved && (
        <p className="mt-3 text-xs text-amber-300/80">
          No canonical account matched &quot;{query.trim()}&quot;.
        </p>
      )}
    </div>
  );
}
