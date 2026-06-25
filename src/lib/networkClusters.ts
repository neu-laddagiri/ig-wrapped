import type {
  CleanupAccount,
  NetworkCluster,
  RealOnesAccount,
  UnifiedAccount,
} from "@/types/insights";

export function computeNetworkClusters(
  accounts: UnifiedAccount[],
  cleanup: CleanupAccount[],
  realOnes: RealOnesAccount[]
): NetworkCluster[] {
  const clusters: NetworkCluster[] = [];

  const dmFriends = accounts.filter(
    (a) => a.hasDmThread && a.dmMessageCount > 20 && !a.isUnknownAccount
  );
  if (dmFriends.length) {
    clusters.push({
      id: "dm-friends",
      title: "Direct DM friends",
      description: "Accounts with active 1-on-1 DM history.",
      count: dmFriends.length,
      usernames: dmFriends.map((a) => a.username).slice(0, 100),
      confidence: "high",
    });
  }

  const groupActive = accounts.filter((a) => (a.groupMessageCount ?? 0) > 10);
  if (groupActive.length) {
    clusters.push({
      id: "group-active",
      title: "Group chat regulars",
      description: "Sent meaningful volume in group chats.",
      count: groupActive.length,
      usernames: groupActive.map((a) => a.username).slice(0, 100),
      confidence: "high",
    });
  }

  const silent = accounts.filter(
    (a) => a.isMutual && a.dmMessageCount === 0 && (a.likedCount ?? 0) < 3
  );
  if (silent.length) {
    clusters.push({
      id: "silent-mutuals",
      title: "Silent mutuals",
      description: "Mutual follows with little interaction.",
      count: silent.length,
      usernames: silent.map((a) => a.username).slice(0, 100),
      confidence: "medium",
    });
  }

  const oneWay = accounts.filter((a) => a.iFollowThem && !a.followsMe);
  if (oneWay.length) {
    clusters.push({
      id: "one-way",
      title: "One-way follows",
      description: "You follow them; they do not follow back.",
      count: oneWay.length,
      usernames: oneWay.map((a) => a.username).slice(0, 100),
      confidence: "high",
    });
  }

  const highCleanup = cleanup.filter((c) =>
    c.label.toLowerCase().includes("high")
  );
  if (highCleanup.length) {
    clusters.push({
      id: "cleanup",
      title: "Cleanup candidates",
      description: "High-priority unfollow review list.",
      count: highCleanup.length,
      usernames: highCleanup.map((a) => a.username).slice(0, 100),
      confidence: "medium",
    });
  }

  const real = realOnes.filter((r) => r.realOnesScore > 50 && !r.isSilentMutual);
  if (real.length) {
    clusters.push({
      id: "real-ones",
      title: "Real ones",
      description: "Strong mutual + interaction signals.",
      count: real.length,
      usernames: real.map((a) => a.username).slice(0, 100),
      confidence: "medium",
    });
  }

  const unknown = accounts.filter((a) => a.isUnknownAccount);
  if (unknown.length) {
    clusters.push({
      id: "unknown",
      title: "Unknown / deleted",
      description: "Export lacked usable account names.",
      count: unknown.length,
      usernames: unknown.map((a) => a.username).slice(0, 100),
      confidence: "low",
    });
  }

  return clusters;
}
