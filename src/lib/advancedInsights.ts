import type { ParsedExportData } from "@/types/instagram";
import type { InsightsBundle } from "@/types/insights";
import { computeDmHeatmap } from "@/lib/dmHeatmap";
import { computeReplyPatterns } from "@/lib/replyPatterns";
import { computeNetworkClusters } from "@/lib/networkClusters";
import { computeWrappedScoreboard } from "@/lib/wrappedScoreboard";
import { computeBurnoutMeter } from "@/lib/burnoutMeter";
import { computeHallOfFame } from "@/lib/hallOfFame";
import { computeYearbook } from "@/lib/yearbook";
import { computeAdRoast } from "@/lib/adRoast";
import { computeSocialAudit } from "@/lib/socialAudit";

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
  const burnoutMeter =
    bundle.burnoutMeter ?? computeBurnoutMeter(parsed, bundle.contentDiet);
  const hallOfFame =
    bundle.hallOfFame ??
    computeHallOfFame(parsed, {
      accounts: bundle.accounts,
      cleanup: bundle.cleanup,
      realOnes: bundle.realOnes,
      silentMutuals: bundle.silentMutuals,
      dmAwards: bundle.dmAwards,
      groupChats: bundle.groupChats,
      leaderboards: bundle.leaderboards,
    });
  const adRoast =
    bundle.adRoast ?? computeAdRoast(parsed.ads, bundle.adsInsights);
  const withExtras = {
    ...bundle,
    dmHeatmap,
    replyPatterns,
    networkClusters,
    wrappedScoreboard,
    burnoutMeter,
    hallOfFame,
    adRoast,
  };
  const yearbook = bundle.yearbook ?? computeYearbook(parsed, withExtras);
  const socialAudit = bundle.socialAudit ?? computeSocialAudit(parsed, withExtras);

  return {
    ...withExtras,
    yearbook,
    socialAudit,
  };
}
