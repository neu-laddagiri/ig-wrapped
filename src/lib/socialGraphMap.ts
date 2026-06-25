import type { UnifiedAccount } from "@/types/insights";

export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number;
  cluster: "dm" | "mutual" | "silent" | "edge" | "group";
  dmCount: number;
}

export type GraphFilter =
  | "all"
  | "dms"
  | "mutuals"
  | "realones"
  | "silent"
  | "cleanup";

export function buildSocialGraphNodes(
  accounts: UnifiedAccount[],
  filter: GraphFilter = "all",
  limit = 80
): GraphNode[] {
  let pool = [...accounts];

  if (filter === "dms") {
    pool = pool.filter((a) => a.dmMessageCount > 0);
  } else if (filter === "mutuals") {
    pool = pool.filter((a) => a.isMutual);
  } else if (filter === "realones") {
    pool = pool
      .filter((a) => a.dmMessageCount > 10)
      .sort((a, b) => b.dmMessageCount - a.dmMessageCount);
  } else if (filter === "silent") {
    pool = pool.filter(
      (a) =>
        a.isMutual &&
        a.dmMessageCount === 0 &&
        a.likedCount + a.commentedCount === 0
    );
  } else if (filter === "cleanup") {
    pool = pool.filter((a) => a.iFollowThem && !a.followsMe && a.dmMessageCount === 0);
  }

  pool = pool
    .sort((a, b) => {
      const scoreA = a.dmMessageCount * 3 + (a.isMutual ? 10 : 0);
      const scoreB = b.dmMessageCount * 3 + (b.isMutual ? 10 : 0);
      return scoreB - scoreA;
    })
    .slice(0, limit);

  const cx = 200;
  const cy = 200;

  return pool.map((acc, i) => {
    const ring =
      acc.dmMessageCount > 50
        ? 60
        : acc.dmMessageCount > 10
          ? 100
          : acc.isMutual
            ? 130
            : 160;
    const angle = (i / Math.max(pool.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const dm = acc.dmMessageCount;
    const r = Math.min(28, 8 + Math.log10(dm + 2) * 6);

    let cluster: GraphNode["cluster"] = "edge";
    if (dm > 20) cluster = "dm";
    else if (acc.isMutual && dm === 0) cluster = "silent";
    else if (acc.isMutual) cluster = "mutual";
    if ((acc.groupMessageCount ?? 0) > 10) cluster = "group";

    return {
      id: acc.username,
      label: acc.displayName,
      x: cx + Math.cos(angle) * ring,
      y: cy + Math.sin(angle) * ring,
      radius: r,
      cluster,
      dmCount: dm,
    };
  });
}
