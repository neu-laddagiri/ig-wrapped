import type { ParsedExportData } from "@/types/instagram";
import type {
  InsightsBundle,
  NetworkCluster,
  WrappedScoreboard,
} from "@/types/insights";
import { computeDmHeatmap } from "@/lib/dmHeatmap";
import { computeReplyPatterns } from "@/lib/replyPatterns";
import { computeNetworkClusters } from "@/lib/networkClusters";
import { computeWrappedScoreboard } from "@/lib/wrappedScoreboard";

export function enrichInsightsBundle(
  bundle: InsightsBundle,
  parsed: ParsedExportData
): InsightsBundle {
  const dmHeatmap = bundle.dmHeatmap ?? computeDmHeatmap(parsed.messages);
  const replyPatterns =
    bundle.replyPatterns ?? computeReplyPatterns(parsed.messages);
  const networkClusters =
    bundle.networkClusters ??
    computeNetworkClusters(bundle.accounts, bundle.cleanup, bundle.realOnes);
  const wrappedScoreboard =
    bundle.wrappedScoreboard ??
    computeWrappedScoreboard(parsed, bundle);

  return {
    ...bundle,
    dmHeatmap,
    replyPatterns,
    networkClusters,
    wrappedScoreboard,
  };
}
