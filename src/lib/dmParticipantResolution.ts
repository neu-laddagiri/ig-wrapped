/**
 * @deprecated Use `@/lib/identityResolver` directly. Re-exports for compatibility.
 */
export {
  inferAccountOwnerKeys,
  buildDmStatsAndDebug,
  buildIdentityGraph,
  personToDmStats,
  toSourceBreakdownFromPerson as toSourceBreakdown,
  findPersonByQuery,
  normalizeIdentityKey,
  compactIdentityKey,
  type DmAccountStats,
  type IdentityGraph,
  type CanonicalPerson,
  type DmMatchStatus,
  type MatchMethod,
  type AttributionStatus,
} from "@/lib/identityResolver";

import type { NetworkStats } from "@/types/instagram";
import { normalizeUsername } from "@/lib/formatters";
import { normalizeIdentityKey } from "@/lib/identityResolver";

/** @deprecated Use buildIdentityGraph alias index instead. */
export function buildParticipantLookup(
  network: NetworkStats
): Map<string, string> {
  const lookup = new Map<string, string>();
  const lists = [
    ...network.followers,
    ...network.following,
    ...network.mutuals,
    ...network.dontFollowMeBack,
    ...network.iDontFollowBack,
    ...network.pendingRequests,
    ...network.recentFollowRequests,
    ...network.recentlyUnfollowed,
    ...network.blocked,
    ...network.restricted,
  ];

  for (const acc of lists) {
    const username = normalizeUsername(acc.username);
    lookup.set(username, username);
    if (acc.displayUsername) {
      lookup.set(normalizeIdentityKey(acc.displayUsername), username);
    }
  }
  return lookup;
}
