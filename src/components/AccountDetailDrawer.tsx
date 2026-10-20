"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Briefcase, Copy, Check, ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import type {
  AccountNetworkDetail,
  LinkedInHelperEntry,
  NetworkStats,
} from "@/types/instagram";
import type { UnifiedAccount, InsightsBundle } from "@/types/insights";
import type { AccountReceipt } from "@/lib/accountReceipt";
import { buildAccountReceipt } from "@/lib/accountReceipt";
import type { AccountReceiptTarget } from "@/lib/canonicalAccounts";
import {
  getDisplayLabel,
  getSecondaryLabel,
  isLikelyInstagramUsername,
  isSyntheticCanonicalKey,
} from "@/lib/accountIdentity";
import { buildAccountNetworkDetail } from "@/lib/networkAccountDetail";
import { redactNameLabel } from "@/lib/dmDisplayLabels";
import { usePresentationMode } from "@/contexts/PresentationContext";
import { AccountSourcesPopover } from "@/components/AccountSourcesPopover";
import { AccountCrmPanel } from "@/components/AccountCrmPanel";
import {
  formatTimestamp,
  instagramProfileUrl,
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

interface DrawerPanelProps {
  onClose: () => void;
  username: string;
  detail: AccountNetworkDetail | null;
  receipt: AccountReceipt | null;
  unifiedAccount?: UnifiedAccount;
  linkedinEntry?: LinkedInHelperEntry;
  insights?: InsightsBundle | null;
  fileFingerprint: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const subscribeNoop = () => () => {};

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

/** Instagram profile URL for real handles only — never for synthetic keys. */
function instagramProfileHref(username: string, href?: string): string | null {
  const handle = username.trim().replace(/^@/, "");
  if (
    !handle ||
    isSyntheticCanonicalKey(handle) ||
    !isLikelyInstagramUsername(handle)
  ) {
    return null;
  }
  if (href && /^https:\/\/(www\.)?instagram\.com\//i.test(href)) return href;
  return instagramProfileUrl(handle);
}

export function AccountDetailDrawer(props: AccountDetailDrawerProps) {
  const isClient = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  );
  if (!isClient) return null;
  return createPortal(<AccountDrawerPresence {...props} />, document.body);
}

function AccountDrawerPresence({
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
  const detail =
    username && network
      ? buildAccountNetworkDetail(network, username, linkedinEntry)
      : null;

  const receipt = !username
    ? null
    : (receiptProp ??
      (network
        ? buildAccountReceipt({
            username,
            network,
            unified: unifiedAccount,
            dmSlice: insights?.dmReceiptByUsername?.[username],
            linkedinEntry,
          })
        : null));

  const visible =
    open && Boolean(username) && Boolean(detail || receipt || unifiedAccount);

  return (
    <AnimatePresence>
      {visible && username && (
        <DrawerPanel
          key="account-drawer"
          onClose={onClose}
          username={username}
          detail={detail}
          receipt={receipt}
          unifiedAccount={unifiedAccount}
          linkedinEntry={linkedinEntry}
          insights={insights}
          fileFingerprint={fileFingerprint}
        />
      )}
    </AnimatePresence>
  );
}

function DrawerPanel({
  onClose,
  username,
  detail,
  receipt,
  unifiedAccount: u,
  linkedinEntry,
  insights,
  fileFingerprint,
}: DrawerPanelProps) {
  const { presentationMode } = usePresentationMode();
  const showNames = !presentationMode;
  const [copied, setCopied] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const opener = document.activeElement;
    // Keep the page behind the drawer from scrolling while it's open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = panelRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!root.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const displayUsername =
    detail?.displayUsername ?? receipt?.displayName ?? username;
  const profileUsername = detail?.username ?? receipt?.username ?? username;
  const isSynthetic = isSyntheticCanonicalKey(profileUsername);
  const profileHref = instagramProfileHref(profileUsername, detail?.href);
  const displayLabel = getDisplayLabel({
    displayName: receipt?.displayName ?? u?.displayName ?? displayUsername,
    username: profileUsername,
  });
  const handleLabel = getSecondaryLabel({ username: profileUsername });
  const hiddenLabel = redactNameLabel(displayLabel, false);
  const isUnknown = Boolean(u?.isUnknownAccount || receipt?.isUnknownAccount);
  const canCopyUsername = showNames && !isSynthetic;
  const canSearchLinkedIn = showNames && !(isSynthetic && isUnknown);

  const copyUsername = async () => {
    try {
      await navigator.clipboard.writeText(profileUsername);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const dm = receipt?.dm;
  const realOne = insights?.realOnes.find(
    (r) =>
      r.username === profileUsername ||
      r.username === u?.username
  );
  const hasDmMatch = dm?.lookupStatus === "matched" && (dm?.directDmCount ?? 0) > 0;
  const hasFooterActions = canCopyUsername || (showNames && profileHref) || canSearchLinkedIn;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <motion.aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0a0a10]/98 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-semibold text-white">
              {showNames ? handleLabel : hiddenLabel}
            </h2>
            <p className="text-xs text-white/40">Friendship receipt</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close account details"
            className="rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4">
            <p className="text-xl font-semibold text-white">
              {showNames ? displayLabel : hiddenLabel}
            </p>
            {showNames && (
              <p className="text-sm text-white/45">{handleLabel}</p>
            )}
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
          <DetailRow
            label="Username"
            value={showNames ? handleLabel : hiddenLabel}
          />
          <DetailRow
            label="Relationship type"
            value={u?.relationshipLabel ?? receipt?.relationshipLabel ?? "—"}
          />
          {isUnknown && (
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

          {showNames && u?.dataSourceNotes && u.dataSourceNotes.length > 0 && (
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
                  aria-hidden
                />
              </button>
              {sourcesOpen && (
                <ul className="mt-2 space-y-1 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2 text-xs text-white/45">
                  {u.dataSourceNotes.map((note, i) => (
                    <li key={`${i}-${note}`}>• {note}</li>
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
              {showNames && linkedinEntry.notes && (
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

          {fileFingerprint &&
            (showNames ? (
              <AccountCrmPanel
                key={`${fileFingerprint}:${profileUsername}`}
                fingerprint={fileFingerprint}
                username={profileUsername}
              />
            ) : (
              <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/40">
                Private notes are hidden while presenting.
              </p>
            ))}

          <p className="mt-4 text-xs leading-relaxed text-white/35">
            Dates come from Instagram export timestamps. Availability
            depends on what Instagram included in your download.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 p-5">
          {canCopyUsername && (
            <button
              type="button"
              onClick={copyUsername}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" aria-hidden />
              )}
              {copied ? "Copied" : "Copy username"}
            </button>
          )}
          {showNames && profileHref && (
            <a
              href={profileHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DD2A7B]/30 bg-[#DD2A7B]/10 px-3 py-2 text-xs text-[#DD2A7B] hover:bg-[#DD2A7B]/20"
            >
              Instagram <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
          {canSearchLinkedIn && (
            <a
              href={linkedInSearchUrl(
                isSynthetic ? displayLabel : profileUsername,
                displayLabel
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#515BD4]/30 bg-[#515BD4]/10 px-3 py-2 text-xs text-[#818cf8] hover:bg-[#515BD4]/20"
            >
              <Briefcase className="h-3.5 w-3.5" aria-hidden />
              Search LinkedIn
            </a>
          )}
          {!hasFooterActions && (
            <p className="text-xs text-white/40">
              {showNames
                ? "No Instagram profile link is available for this account."
                : "Profile links are hidden while presenting."}
            </p>
          )}
        </div>
      </motion.aside>
    </>
  );
}

export function useAccountDetail() {
  const [selection, setSelection] = useState<{
    accountKey?: string;
    threadId?: string;
  } | null>(null);

  const openAccount = useCallback((target: AccountReceiptTarget) => {
    if (typeof target === "string") {
      setSelection({ accountKey: target.trim() });
      return;
    }
    setSelection({
      accountKey: target.accountKey?.trim(),
      threadId: target.threadId?.trim(),
    });
  }, []);

  const closeAccount = useCallback(() => {
    setSelection(null);
  }, []);

  return {
    selection,
    selectedAccountKey: selection?.accountKey ?? selection?.threadId ?? null,
    selectedUsername: selection?.accountKey ?? selection?.threadId ?? null,
    selectedReceipt: null as AccountReceipt | null,
    openAccount,
    closeAccount,
    isOpen: Boolean(selection?.accountKey || selection?.threadId),
  };
}
