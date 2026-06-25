"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Briefcase, Copy, Check } from "lucide-react";
import { useState } from "react";
import type {
  AccountNetworkDetail,
  LinkedInHelperEntry,
  NetworkStats,
} from "@/types/instagram";
import type { UnifiedAccount } from "@/types/insights";
import { buildAccountNetworkDetail } from "@/lib/networkAccountDetail";
import {
  formatTimestamp,
  linkedInSearchUrl,
  normalizeUsername,
} from "@/lib/formatters";

interface AccountDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  username: string | null;
  network: NetworkStats | null;
  linkedinEntry?: LinkedInHelperEntry;
  unifiedAccount?: UnifiedAccount;
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

export function AccountDetailDrawer({
  open,
  onClose,
  username,
  network,
  linkedinEntry,
  unifiedAccount,
}: AccountDetailDrawerProps) {
  const [copied, setCopied] = useState(false);

  if (!username || !network) return null;

  const detail: AccountNetworkDetail | null = buildAccountNetworkDetail(
    network,
    username,
    linkedinEntry
  );

  if (!detail) return null;

  const copyUsername = async () => {
    try {
      await navigator.clipboard.writeText(detail.displayUsername);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const u = unifiedAccount;

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
                  @{detail.displayUsername}
                </h2>
                <p className="text-xs text-white/40">Account details</p>
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
              <div className="mb-4 flex flex-wrap gap-2">
                {(u ? [u.relationshipLabel] : detail.categories).map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-white/70"
                  >
                    {c}
                  </span>
                ))}
              </div>

              <SectionTitle>Identity</SectionTitle>
              <DetailRow label="Username" value={`@${detail.username}`} />
              <DetailRow
                label="Relationship type"
                value={u?.relationshipLabel ?? "—"}
              />
              {u?.isUnknownAccount && (
                <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100/80">
                  Instagram&apos;s export did not include a usable name for this
                  account. This may be a deleted, deactivated, renamed, or
                  unavailable account.
                </p>
              )}

              <SectionTitle>Follow relationship</SectionTitle>
              <DetailRow
                label="Follows you"
                value={detail.followsMe ? "Yes" : "No"}
              />
              <DetailRow
                label="You follow"
                value={detail.iFollowThem ? "Yes" : "No"}
              />
              <DetailRow label="Mutual" value={detail.isMutual ? "Yes" : "No"} />
              <DetailRow
                label="Who followed first"
                value={u?.whoFollowedFirst ?? "Unknown"}
              />
              <DetailRow
                label="Follow-back time"
                value={
                  u?.followBackTimeMs
                    ? `${Math.round(u.followBackTimeMs / 86400000)} days`
                    : "—"
                }
              />

              <SectionTitle>Relationship timeline</SectionTitle>
              <DetailRow
                label="They followed you"
                value={formatTimestamp(detail.followedMeAt)}
              />
              <DetailRow
                label="You followed them"
                value={formatTimestamp(detail.iFollowedAt)}
              />
              <DetailRow
                label="First connected"
                value={formatTimestamp(u?.firstConnectedAt ?? detail.firstConnectedAt)}
              />
              <DetailRow
                label="Became mutual"
                value={formatTimestamp(u?.becameMutualAt ?? detail.becameMutualAt)}
              />

              <SectionTitle>DM connection</SectionTitle>
              <DetailRow
                label="Has DM thread"
                value={u?.hasDmThread ? "Yes" : "No"}
              />
              <DetailRow
                label="DM messages (1-on-1)"
                value={u?.dmMessageCount?.toLocaleString() ?? "0"}
              />
              {(u?.groupMessageCount ?? 0) > 0 && (
                <DetailRow
                  label="Group messages sent"
                  value={u?.groupMessageCount?.toLocaleString() ?? "0"}
                />
              )}
              <DetailRow
                label="Last DM"
                value={formatTimestamp(u?.lastDmAt)}
              />

              {(u?.likedCount || u?.commentedCount || u?.storyInteractionCount) ? (
                <>
                  <SectionTitle>Interaction stats</SectionTitle>
                  <DetailRow label="Likes" value={u?.likedCount ?? 0} />
                  <DetailRow label="Comments" value={u?.commentedCount ?? 0} />
                  <DetailRow
                    label="Story interactions"
                    value={u?.storyInteractionCount ?? 0}
                  />
                </>
              ) : null}

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
                  "Review this account in Network Manager."}
              </p>

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
                href={detail.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#DD2A7B]/30 bg-[#DD2A7B]/10 px-3 py-2 text-xs text-[#DD2A7B] hover:bg-[#DD2A7B]/20"
              >
                Instagram <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <a
                href={linkedInSearchUrl(detail.displayUsername)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#515BD4]/30 bg-[#515BD4]/10 px-3 py-2 text-xs text-[#818cf8] hover:bg-[#515BD4]/20"
              >
                <Briefcase className="h-3.5 w-3.5" />
                LinkedIn search
              </a>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export function useAccountDetail() {
  const [selectedUsername, setSelectedUsername] = useState<string | null>(
    null
  );

  return {
    selectedUsername,
    openAccount: (username: string) =>
      setSelectedUsername(normalizeUsername(username)),
    closeAccount: () => setSelectedUsername(null),
    isOpen: Boolean(selectedUsername),
  };
}
