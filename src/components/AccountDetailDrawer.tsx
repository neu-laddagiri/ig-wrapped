"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, ExternalLink, Briefcase, Copy, Check, ChevronDown } from "lucide-react";
import { useId, useRef, useState } from "react";
import type {
  AccountNetworkDetail,
  LinkedInHelperEntry,
  NetworkStats,
} from "@/types/instagram";
import type { UnifiedAccount, InsightsBundle } from "@/types/insights";
import type { AccountReceipt } from "@/lib/accountReceipt";
import { buildAccountReceipt } from "@/lib/accountReceipt";
import type { AccountReceiptTarget } from "@/lib/canonicalAccounts";
import { getDisplayLabel, getSecondaryLabel } from "@/lib/accountIdentity";
import { buildAccountNetworkDetail } from "@/lib/networkAccountDetail";
import { AccountSourcesPopover } from "@/components/AccountSourcesPopover";
import { AccountCrmPanel } from "@/components/AccountCrmPanel";
import {
  formatTimestamp,
  linkedInSearchUrl,
} from "@/lib/formatters";
import { useAccessibleDialog } from "@/components/useAccessibleDialog";

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

function dmThreadLabel(dm?: AccountReceipt["dm"]): string {
  if (dm?.lookupStatus === "matched" || (dm?.directDmCount ?? 0) > 0) {
    return "Yes";
  }
  if (dm?.lookupStatus === "not-found") return "Not found";
  return "Not found";
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
  const titleId = useId();
  const descriptionId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const resolvedUsername = username ?? "";

  const detail: AccountNetworkDetail | null = network && resolvedUsername
    ? buildAccountNetworkDetail(network, resolvedUsername, linkedinEntry)
    : null;

  const receipt =
    receiptProp ??
    (network && resolvedUsername
      ? buildAccountReceipt({
          username: resolvedUsername,
          network,
          unified: unifiedAccount,
          dmSlice: insights?.dmReceiptByUsername?.[resolvedUsername],
          linkedinEntry,
        })
      : null);

  const hasContent = Boolean(
    resolvedUsername && (detail || receipt || unifiedAccount)
  );
  const dialogRef = useAccessibleDialog<HTMLElement>({
    open: open && hasContent,
    onClose,
    initialFocusRef: closeButtonRef,
  });

  if (!hasContent) return null;

  const displayUsername =
    detail?.displayUsername ?? receipt?.displayName ?? resolvedUsername;
  const profileUsername =
    detail?.username ?? receipt?.username ?? resolvedUsername;
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
  const realOne = insights?.realOnes.find(
    (r) =>
      r.username === profileUsername ||
      r.username === u?.username
  );
  const hasDmMatch = dm?.lookupStatus === "matched" && (dm?.directDmCount ?? 0) > 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : undefined}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.aside
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            initial={prefersReducedMotion ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { type: "spring", damping: 28, stiffness: 320 }
            }
            className="fixed right-0 top-0 z-50 flex h-dvh w-full max-w-md flex-col border-l border-white/10 bg-[#0a0a10]/98 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-white">
                  {getSecondaryLabel({ username: profileUsername })}
                </h2>
                <p id={descriptionId} className="text-xs text-white/60">
                  Friendship receipt
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Close account details"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
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

              <SectionTitle>Available matched data</SectionTitle>
              <DetailRow
                label="Network · follows you"
                value={(receipt?.followsMe ?? detail?.followsMe) ? "Yes" : "No"}
              />
              <DetailRow
                label="Network · you follow"
                value={(receipt?.iFollowThem ?? detail?.iFollowThem) ? "Yes" : "No"}
              />
              <DetailRow
                label="Network · mutual"
                value={(receipt?.isMutual ?? detail?.isMutual) ? "Yes" : "No"}
              />
              <DetailRow label="Direct DM thread" value={dmThreadLabel(dm)} />
              <DetailRow
                label="Direct DM messages"
                value={
                  hasDmMatch
                    ? dm!.directDmCount.toLocaleString()
                    : dm?.lookupStatus === "not-found"
                      ? "No direct 1-on-1 thread in export"
                      : "—"
                }
              />
              <DetailRow
                label="First DM"
                value={hasDmMatch ? formatTimestamp(dm?.firstDmAt) : "—"}
              />
              <DetailRow
                label="Last DM"
                value={hasDmMatch ? formatTimestamp(dm?.lastDmAt) : "—"}
              />
              <DetailRow
                label="Match source"
                value={hasDmMatch ? (dm?.matchSource ?? "DM thread source of truth") : "—"}
              />
              <DetailRow
                label="Confidence"
                value={hasDmMatch ? (dm?.matchConfidence ?? "high") : "—"}
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
                    aria-expanded={sourcesOpen}
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
              <span className="sr-only" role="status" aria-live="polite">
                {copied ? "Username copied" : ""}
              </span>
              <button
                type="button"
                onClick={copyUsername}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
              >
                {copied ? (
                  <Check
                    className="h-3.5 w-3.5 text-emerald-400"
                    aria-hidden="true"
                  />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                Copy username
              </button>
              <a
                href={profileHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#DD2A7B]/30 bg-[#DD2A7B]/10 px-3 py-2 text-xs text-[#DD2A7B] hover:bg-[#DD2A7B]/20"
              >
                Instagram
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <a
                href={linkedInSearchUrl(profileUsername, displayUsername)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#515BD4]/30 bg-[#515BD4]/10 px-3 py-2 text-xs text-[#818cf8] hover:bg-[#515BD4]/20"
              >
                <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
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
  const [selection, setSelection] = useState<{
    accountKey?: string;
    threadId?: string;
  } | null>(null);

  return {
    selection,
    selectedAccountKey: selection?.accountKey ?? selection?.threadId ?? null,
    selectedUsername: selection?.accountKey ?? selection?.threadId ?? null,
    selectedReceipt: null as AccountReceipt | null,
    openAccount: (target: AccountReceiptTarget) => {
      if (typeof target === "string") {
        setSelection({ accountKey: target.trim() });
        return;
      }
      setSelection({
        accountKey: target.accountKey?.trim(),
        threadId: target.threadId?.trim(),
      });
    },
    closeAccount: () => {
      setSelection(null);
    },
    isOpen: Boolean(selection?.accountKey || selection?.threadId),
  };
}
