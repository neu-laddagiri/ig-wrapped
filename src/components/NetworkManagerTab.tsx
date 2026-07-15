"use client";

import { useState } from "react";
import {
  Users,
  UserCheck,
  UserMinus,
  UserX,
  Clock,
  Ban,
  EyeOff,
  Handshake,
} from "lucide-react";
import type { LinkedInHelperEntry, NetworkStats, NetworkListKey } from "@/types/instagram";
import { TAB_SELECTED, TAB_INACTIVE } from "@/lib/tabStyles";
import { SummaryCard } from "@/components/SummaryCard";
import { AccountTable } from "@/components/AccountTable";
import { formatNumber, formatPercent } from "@/lib/formatters";

interface NetworkManagerTabProps {
  network: NetworkStats | null;
  linkedinProgress?: LinkedInHelperEntry[];
  onOpenAccount?: (username: string) => void;
}

function listCountLabel(
  network: NetworkStats,
  key: NetworkListKey
): string {
  if (key === "blocked" && network.blockedMeta && !network.blockedMeta.includedInExport) {
    return "Not in export";
  }
  if (key === "restricted" && network.restrictedMeta && !network.restrictedMeta.includedInExport) {
    return "Not in export";
  }
  return formatNumber(network[key].length);
}

const listConfig: {
  key: NetworkListKey;
  label: string;
  exportName: string;
}[] = [
  { key: "dontFollowMeBack", label: "Don't follow me back", exportName: "dont-follow-me-back.csv" },
  { key: "iDontFollowBack", label: "I don't follow back", exportName: "i-dont-follow-back.csv" },
  { key: "mutuals", label: "Mutuals", exportName: "mutuals.csv" },
  { key: "followers", label: "Followers", exportName: "followers.csv" },
  { key: "following", label: "Following", exportName: "following.csv" },
  { key: "pendingRequests", label: "Pending requests", exportName: "pending-requests.csv" },
  { key: "recentFollowRequests", label: "Recent requests", exportName: "recent-follow-requests.csv" },
  { key: "recentlyUnfollowed", label: "Recently unfollowed", exportName: "recently-unfollowed.csv" },
  { key: "blocked", label: "Blocked", exportName: "blocked.csv" },
  { key: "restricted", label: "Restricted", exportName: "restricted.csv" },
];

export function NetworkManagerTab({
  network,
  onOpenAccount,
}: NetworkManagerTabProps) {
  const [activeList, setActiveList] = useState<NetworkListKey>("dontFollowMeBack");

  if (!network) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
        <Users className="mx-auto h-10 w-10 text-white/20" />
        <h3 className="mt-4 text-lg font-semibold text-white">
          Network data not found
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
          We couldn&apos;t find followers or following files in your export.
          Make sure your ZIP includes{" "}
          <code className="text-white/60">connections/followers_and_following/</code>.
        </p>
      </div>
    );
  }

  const activeConfig = listConfig.find((c) => c.key === activeList)!;
  const activeAccounts = network[activeList];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Followers"
          value={formatNumber(network.totalFollowers)}
          icon={Users}
          accent="pink"
        />
        <SummaryCard
          label="Following"
          value={formatNumber(network.totalFollowing)}
          icon={UserCheck}
          accent="purple"
        />
        <SummaryCard
          label="Mutuals"
          value={formatNumber(network.mutuals.length)}
          icon={Handshake}
          accent="blue"
        />
        <SummaryCard
          label="Follow-back ratio"
          value={formatPercent(network.followBackRatio)}
          sublabel={`${formatNumber(network.dontFollowMeBack.length)} don't follow back`}
          icon={UserMinus}
          accent="orange"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard
          label="Don't follow back"
          value={formatNumber(network.dontFollowMeBack.length)}
          icon={UserX}
          accent="orange"
        />
        <SummaryCard
          label="I don't follow back"
          value={formatNumber(network.iDontFollowBack.length)}
          icon={UserMinus}
          accent="pink"
        />
        <SummaryCard
          label="Pending"
          value={formatNumber(network.pendingRequests.length)}
          icon={Clock}
          accent="blue"
        />
        <SummaryCard
          label="Unfollowed"
          value={formatNumber(network.recentlyUnfollowed.length)}
          icon={UserX}
          accent="purple"
        />
        <SummaryCard
          label="Blocked"
          value={listCountLabel(network, "blocked")}
          sublabel={
            network.blockedMeta?.includedInExport
              ? network.blockedMeta.sourcePath?.split("/").pop()
              : "Not included in this export"
          }
          icon={Ban}
          accent="orange"
        />
        <SummaryCard
          label="Restricted"
          value={listCountLabel(network, "restricted")}
          sublabel={
            network.restrictedMeta?.includedInExport
              ? network.restrictedMeta.sourcePath?.split("/").pop()
              : "Not included in this export"
          }
          icon={EyeOff}
          accent="green"
        />
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-2 pb-1">
          {listConfig.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveList(item.key)}
              className={
                activeList === item.key
                  ? `${TAB_SELECTED} text-xs`
                  : `${TAB_INACTIVE} text-xs hover:text-white/80`
              }
            >
              {item.label} ({listCountLabel(network, item.key)})
            </button>
          ))}
        </div>
      </div>

      <AccountTable
        accounts={activeAccounts}
        title={activeConfig.label}
        exportFilename={activeConfig.exportName}
        onAccountClick={(a) => onOpenAccount?.(a.username)}
      />
    </div>
  );
}
