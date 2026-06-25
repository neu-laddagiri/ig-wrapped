"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Briefcase, Copy, Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import type {
  AccountNetworkDetail,
  LinkedInHelperEntry,
  NetworkStats,
} from "@/types/instagram";
import type { UnifiedAccount, InsightsBundle } from "@/types/insights";
import type { AccountReceipt } from "@/lib/accountReceipt";
import { buildAccountReceipt } from "@/lib/accountReceipt";
import { getDisplayLabel, getSecondaryLabel } from "@/lib/accountIdentity";
import { computeAccountFlags } from "@/lib/accountInsights";
import { buildAccountNetworkDetail } from "@/lib/networkAccountDetail";
import { AccountSourcesPopover } from "@/components/AccountSourcesPopover";
import { AccountCrmPanel } from "@/components/AccountCrmPanel";
import {
  formatTimestamp,
  linkedInSearchUrl,
} from "@/lib/formatters";

interface AccountDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  username: string | null;
  network: NetworkStats | null;
  linkedinEntry?: LinkedInHelperEntry;
  unifiedAccount?: UnifiedAccount;
  receipt?: AccountReceipt | null;
  insights?: InsightsBundle | null;
  fileFingerprint?: string;
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-white/5 py-2.5 text-sm">
      <span className="text-white/45">{label}</span>
      <span className="text-right text-white/90">{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-widest text-white/35">
      {children}
    </h4>
  );
}

function dmThreadLabel(dm?: AccountReceipt["dm"], u?: UnifiedAccount): string {
  const count = dm?.directDmCount ?? u?.dmMessageCount ?? 0;
  if (count > 0 || dm?.hasDirectThread || u?.hasDmThread) return "Yes";
  if (u?.dmMatchStatus === "possible") return "Possible";
  return "No";
}

export function AccountDetailDrawer({
  open,
  onClose,
  username,
  network,
  linkedinEntry,
  unifiedAccount,
  receipt: receiptProp,
  insights,
  fileFingerprint = "",
}: AccountDetailDrawerProps) {
  const [copied, setCopied] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  if (!username) return null;

  const detail: AccountNetworkDetail | null = network
    ? buildAccountNetworkDetail(network, username, linkedinEntry)
    : null;

  const receipt =
    receiptProp ??
    (network
      ? buildAccountReceipt({
          username,
          network,
          unified: unifiedAccount,
          dmSlice: insights?.dmReceiptByUsername?.[username],
          linkedinEntry,
        })
      : null);

  if (!detail && !receipt && !unifiedAccount) return null;

  const displayUsername =
    detail?.displayUsername ?? receipt?.displayName ?? username;
  const profileUsername = detail?.username ?? receipt?.username ?? username;
  const profileHref =
    detail?.href ??
    (profileUsername.startsWith("thread:") ||
    profileUsername.startsWith("unknown:")
      ? "#"
      : `https://instagram.com/${profileUsername.replace(/^@/, "")}`);
  const copyUsername = async () => {
    try {
      await navigator.clipboard.writeText(profileUsername);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const u = unifiedAccount;
  const dm = receipt?.dm;
  const flags = u ? computeAccountFlags(u, insights) : { green: [], red: [] };
  const realOne = insights?.realOnes.find(
    (r) =>
      r.username === profileUsername ||
      r.username === u?.username
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0a0a10]/98 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {getSecondaryLabel({ username: profileUsername })}
                </h2>
                <p className="text-xs text-white/40">Friendship receipt</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-4">
                <p className="text-xl font-semibold text-white">
                  {getDisplayLabel({
                    displayName: receipt?.displayName ?? u?.displayName ?? displayUsername,
                    username: profileUsername,
                  })}
                </p>
                <p className="text-sm text-white/45">
                  {getSecondaryLabel({ username: profileUsername })}
                </p>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                {(u
                  ? [u.relationshipLabel]
                  : detail?.categories ?? []
                ).map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-white/70"
                  >
                    {c}
                  </span>
                ))}
              </div>

              <SectionTitle>Identity</SectionTitle>
              <DetailRow label="Username" value={getSecondaryLabel({ username: profileUsername })} />
              <DetailRow
                label="Relationship type"
                value={u?.relationshipLabel ?? receipt?.relationshipLabel ?? "—"}
              />
              {(u?.isUnknownAccount || receipt?.isUnknownAccount) && (
                <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100/80">
                  Instagram&apos;s export did not include a usable name for this
                  account. This may be a deleted, deactivated, renamed, or
                  unavailable account.
                </p>
              )}

              {(flags.green.length > 0 || flags.red.length > 0) && (
                <>
                  <SectionTitle>Account flags</SectionTitle>
                  {flags.green.length > 0 && (
                    <div className="mb-3 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase text-emerald-300/80">
                        Green flags
                      </p>
                      <ul className="mt-1 space-y-1">
                        {flags.green.map((f) => (
                          <li key={f.id} className="text-xs text-emerald-100/90">
                            + {f.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {flags.red.length > 0 && (
                    <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase text-red-300/80">
                        Red flags
                      </p>
                      <ul className="mt-1 space-y-1">
                        {flags.red.map((f) => (
                          <li key={f.id} className="text-xs text-red-100/90">
                            − {f.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              <SectionTitle>Network status</SectionTitle>
              <DetailRow
                label="Relationship"
                value={
                  u?.relationshipLabel ??
                  receipt?.relationshipLabel ??
                  (detail?.categories.join(", ") || "—")
                }
              />
              <DetailRow
                label="Follows you"
                value={(receipt?.followsMe ?? detail?.followsMe) ? "Yes" : "No"}
              />
              <DetailRow
                label="You follow"
                value={(receipt?.iFollowThem ?? detail?.iFollowThem) ? "Yes" : "No"}
              />
              <DetailRow
                label="Mutual"
                value={(receipt?.isMutual ?? detail?.isMutual) ? "Yes" : "No"}
              />

              <SectionTitle>Direct messages</SectionTitle>
              <DetailRow label="Direct DM thread" value={dmThreadLabel(dm, u)} />
              <DetailRow
                label="Direct DM messages"
                value={
                  (dm?.directDmCount ?? u?.dmMessageCount ?? 0) > 0
                    ? (dm?.directDmCount ?? u?.dmMessageCount ?? 0).toLocaleString()
                    : "No direct 1-on-1 DM thread matched"
                }
              />
              {(dm?.directDmCount ?? u?.dmMessageCount ?? 0) > 0 &&
                (dm?.senderSplitAvailable || u?.dmSenderSplitAvailable ? (
                  <>
                    <DetailRow
                      label="Sent by you"
                      value={(
                        dm?.sentByMe ??
                        u?.dmSentByMe
                      )?.toLocaleString() ?? "—"}
                    />
                    <DetailRow
                      label="Sent by them"
                      value={(
                        dm?.sentByThem ??
                        u?.dmSentByThem
                      )?.toLocaleString() ?? "—"}
                    />
                  </>
                ) : null)}
              <DetailRow
                label="First DM"
                value={formatTimestamp(dm?.firstDmAt ?? u?.firstDmAt)}
              />
              <DetailRow
                label="Last DM"
                value={formatTimestamp(dm?.lastDmAt ?? u?.lastDmAt)}
              />
              <DetailRow
                label="Match confidence"
                value={dm?.matchConfidence ?? u?.nameConfidence ?? "—"}
              />
              <DetailRow
                label="Match source"
                value={dm?.matchSource ?? u?.dmMatchMethod?.replace(/-/g, " ") ?? "—"}
              />
              {(u?.groupMessageCount ?? 0) > 0 && (
                <DetailRow
                  label="Group messages sent"
                  value={u!.groupMessageCount!.toLocaleString()}
                />
              )}

              {u?.dataSourceNotes && u.dataSourceNotes.length > 0 && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setSourcesOpen((o) => !o)}
                    className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs font-medium text-white/60"
                  >
                    Why this says this
                    <ChevronDown
                      className={`h-4 w-4 transition ${sourcesOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {sourcesOpen && (
                    <ul className="mt-2 space-y-1 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-xs text-white/45">
                      {u.dataSourceNotes.map((note) => (
                        <li key={note}>• {note}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {linkedinEntry && (
                <>
                  <SectionTitle>LinkedIn helper</SectionTitle>
                  <DetailRow
                    label="Status"
                    value={linkedinEntry.status.replace(/-/g, " ")}
                  />
                  {linkedinEntry.notes && (
                    <DetailRow label="Notes" value={linkedinEntry.notes} />
                  )}
                </>
              )}

              <SectionTitle>Recommended action</SectionTitle>
              <p className="text-sm text-white/55">
                {u?.recommendedAction ??
                  receipt?.recommendedAction ??
                  "Review this account in Network Manager."}
              </p>

              {realOne?.rankReason && (
                <>
                  <SectionTitle>Why they ranked</SectionTitle>
                  <p className="text-sm text-white/55">{realOne.rankReason}</p>
                </>
              )}

              {u?.sourceBreakdown && (
                <div className="mt-3">
                  <AccountSourcesPopover breakdown={u.sourceBreakdown} />
                </div>
              )}

              {fileFingerprint && (
                <AccountCrmPanel
                  fingerprint={fileFingerprint}
                  username={profileUsername}
                />
              )}

              <p className="mt-4 text-xs leading-relaxed text-white/35">
                Dates come from Instagram export timestamps. Availability
                depends on what Instagram included in your download.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-white/10 p-5">
              <button
                type="button"
                onClick={copyUsername}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Copy username
              </button>
              <a
                href={profileHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#DD2A7B]/30 bg-[#DD2A7B]/10 px-3 py-2 text-xs text-[#DD2A7B] hover:bg-[#DD2A7B]/20"
              >
                Instagram <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href={linkedInSearchUrl(profileUsername, displayUsername)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#515BD4]/30 bg-[#515BD4]/10 px-3 py-2 text-xs text-[#818cf8] hover:bg-[#515BD4]/20"
              >
                <Briefcase className="h-3.5 w-3.5" />
                Search LinkedIn
              </a>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function useAccountDetail() {
  const [selectedAccountKey, setSelectedAccountKey] = useState<string | null>(
    null
  );

  return {
    selectedAccountKey,
    /** @deprecated use selectedAccountKey */
    selectedUsername: selectedAccountKey,
    selectedReceipt: null as AccountReceipt | null,
    openAccount: (accountKey: string) => {
      setSelectedAccountKey(accountKey.trim());
    },
    closeAccount: () => {
      setSelectedAccountKey(null);
    },
    isOpen: Boolean(selectedAccountKey),
  };
}
