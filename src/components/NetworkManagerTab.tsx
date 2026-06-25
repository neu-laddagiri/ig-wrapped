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
import { SummaryCard } from "@/components/SummaryCard";
import { AccountTable } from "@/components/AccountTable";
import { formatNumber, formatPercent } from "@/lib/formatters";

interface NetworkManagerTabProps {
  network: NetworkStats | null;
  linkedinProgress?: LinkedInHelperEntry[];
  onOpenAccount?: (username: string) => void;
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
  linkedinProgress = [],
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
          value={formatNumber(network.blocked.length)}
          icon={Ban}
          accent="orange"
        />
        <SummaryCard
          label="Restricted"
          value={formatNumber(network.restricted.length)}
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
              className={`rounded-xl px-3 py-2 text-xs font-medium transition ${
                activeList === item.key
                  ? "animated-gradient-bg text-white border border-white/15"
                  : "bg-white/5 text-white/50 hover:text-white/80 border border-transparent"
              }`}
            >
              {item.label} ({formatNumber(network[item.key].length)})
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
