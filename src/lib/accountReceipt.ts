import { getDisplayLabel } from "@/lib/accountIdentity";
import type { DmLookupResult } from "@/lib/dmAccountIndex";
import type {
  LinkedInHelperEntry,
  NetworkStats,
} from "@/types/instagram";
import type { NameConfidence, UnifiedAccount } from "@/types/insights";
import { buildAccountNetworkDetail } from "@/lib/networkAccountDetail";

export interface AccountReceiptDm {
  hasDirectThread: boolean;
  directDmCount: number;
  firstDmAt?: number;
  lastDmAt?: number;
  sentByMe?: number;
  sentByThem?: number;
  senderSplitAvailable: boolean;
  matchConfidence?: NameConfidence;
  matchSource?: string;
  lookupStatus?: "matched" | "not-found";
}

export interface AccountReceipt {
  username: string;
  displayName: string;
  followsMe: boolean;
  iFollowThem: boolean;
  isMutual: boolean;
  relationshipLabel?: string;
  recommendedAction?: string;
  isUnknownAccount?: boolean;
  dm: AccountReceiptDm;
}

export type DmReceiptByUsername = Record<string, AccountReceiptDm>;

function dmSliceFromLookup(hit: DmLookupResult): AccountReceiptDm {
  const { entry, matchMethod, matchConfidence } = hit;
  return {
    hasDirectThread: entry.directDmCount > 0,
    directDmCount: entry.directDmCount,
    firstDmAt: entry.firstDmAt,
    lastDmAt: entry.lastDmAt,
    sentByMe: entry.senderSplitAvailable ? entry.directDmSentByMe : undefined,
    sentByThem: entry.senderSplitAvailable ? entry.directDmSentByThem : undefined,
    senderSplitAvailable: entry.senderSplitAvailable,
    matchConfidence,
    matchSource: matchMethod.replace(/-/g, " "),
  };
}

function dmSliceFromUnified(account: UnifiedAccount): AccountReceiptDm {
  const count = account.dmMessageCount ?? 0;
  return {
    hasDirectThread: count > 0 || Boolean(account.hasDmThread),
    directDmCount: count,
    firstDmAt: account.firstDmAt,
    lastDmAt: account.lastDmAt,
    sentByMe: account.dmSenderSplitAvailable ? account.dmSentByMe : undefined,
    sentByThem: account.dmSenderSplitAvailable ? account.dmSentByThem : undefined,
    senderSplitAvailable: Boolean(account.dmSenderSplitAvailable),
    matchConfidence: account.nameConfidence,
    matchSource: account.dmMatchMethod?.replace(/-/g, " "),
  };
}

export function mergeDmSlices(
  unified?: UnifiedAccount,
  lookup?: DmLookupResult | null,
  precomputed?: AccountReceiptDm
): AccountReceiptDm {
  const fromUnified = unified ? dmSliceFromUnified(unified) : null;
  const fromLookup = lookup ? dmSliceFromLookup(lookup) : null;
  const base = precomputed ?? fromUnified ?? fromLookup;

  if (!base && !fromUnified && !fromLookup) {
    return {
      hasDirectThread: false,
      directDmCount: 0,
      senderSplitAvailable: false,
    };
  }

  const count = Math.max(
    fromUnified?.directDmCount ?? 0,
    fromLookup?.directDmCount ?? 0,
    precomputed?.directDmCount ?? 0
  );

  const best =
    (fromLookup?.directDmCount ?? 0) >= (fromUnified?.directDmCount ?? 0)
      ? fromLookup
      : fromUnified;
  const slice = best ?? precomputed ?? fromUnified ?? fromLookup!;

  return {
    hasDirectThread: count > 0,
    directDmCount: count,
    firstDmAt: slice.firstDmAt ?? fromUnified?.firstDmAt ?? fromLookup?.firstDmAt,
    lastDmAt: slice.lastDmAt ?? fromUnified?.lastDmAt ?? fromLookup?.lastDmAt,
    sentByMe: slice.senderSplitAvailable ? slice.sentByMe : undefined,
    sentByThem: slice.senderSplitAvailable ? slice.sentByThem : undefined,
    senderSplitAvailable: Boolean(slice.senderSplitAvailable),
    matchConfidence: slice.matchConfidence ?? fromUnified?.matchConfidence,
    matchSource: slice.matchSource ?? fromUnified?.matchSource,
  };
}

export function buildDmReceiptIndex(
  accounts: UnifiedAccount[]
): DmReceiptByUsername {
  const index: DmReceiptByUsername = {};
  for (const account of accounts) {
    if ((account.dmMessageCount ?? 0) > 0 || account.hasDmThread) {
      index[account.username] = dmSliceFromUnified(account);
    }
  }
  return index;
}

export function buildAccountReceipt(params: {
  username: string;
  network: NetworkStats;
  unified?: UnifiedAccount;
  dmSlice?: AccountReceiptDm;
  linkedinEntry?: LinkedInHelperEntry;
}): AccountReceipt | null {
  const { username, network, unified, dmSlice, linkedinEntry } = params;
  const detail = buildAccountNetworkDetail(network, username, linkedinEntry);
  if (!detail && !unified) return null;

  const dm = mergeDmSlices(unified, null, dmSlice);

  return {
    username,
    displayName: getDisplayLabel({
      displayName:
        unified?.displayName ??
        detail?.displayUsername ??
        linkedinEntry?.displayUsername,
      username,
    }),
    followsMe: unified?.followsMe ?? detail?.followsMe ?? false,
    iFollowThem: unified?.iFollowThem ?? detail?.iFollowThem ?? false,
    isMutual: unified?.isMutual ?? detail?.isMutual ?? false,
    relationshipLabel: unified?.relationshipLabel,
    recommendedAction: unified?.recommendedAction,
    isUnknownAccount: unified?.isUnknownAccount,
    dm,
  };
}
