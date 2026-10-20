import type { InsightsBundle, YearbookCard } from "@/types/insights";
import type { ParsedExportData } from "@/types/instagram";
import { formatAccountDisplayName } from "@/lib/accountNameFilter";
import { dmThreadSizes, isDmAwardMeaningful } from "@/lib/funStats";
import { isGhostAwardCandidate } from "@/lib/hallOfFame";

function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? word : pluralWord}`;
}

export function computeYearbook(
  parsed: ParsedExportData,
  bundle: InsightsBundle
): YearbookCard[] {
  const cards: YearbookCard[] = [];
  const threadSizes = dmThreadSizes(parsed.messages);

  const reelsDealer = bundle.dmAwards.find((a) => a.id === "reels-dealer");
  if (reelsDealer) {
    cards.push({
      id: "reels",
      superlative: "Most likely to send reels",
      winnerLabel: reelsDealer.threadLabel,
      caption: reelsDealer.description,
      category: "DMs",
      confidence: "high",
      icon: "🎬",
    });
  }

  const ghost = bundle.accounts
    .filter((a) => a.dmMessageCount > 20 && a.lastDmAt && isGhostAwardCandidate(a))
    .sort((a, b) => (a.lastDmAt ?? 0) - (b.lastDmAt ?? 0))[0];
  if (ghost) {
    cards.push({
      id: "ghost",
      superlative: "Most likely to ghost",
      winnerLabel: formatAccountDisplayName(ghost.displayName),
      winnerUsername: ghost.username,
      caption: "Long DM history, quiet lately.",
      category: "DMs",
      confidence: "medium",
      icon: "👻",
    });
  }

  const groupHero = [...bundle.groupChats].sort(
    (a, b) => b.totalMessages - a.totalMessages
  )[0];
  if (groupHero) {
    cards.push({
      id: "group-carry",
      superlative: "Most likely to carry the group chat",
      winnerLabel: groupHero.topSender ?? groupHero.title,
      caption: groupHero.topSender
        ? `Top sender in your busiest group chat (${plural(groupHero.totalMessages, "message")} total).`
        : `Your busiest group chat · ${plural(groupHero.totalMessages, "message")}.`,
      category: "Groups",
      confidence: "high",
      icon: "💬",
    });
  }

  const silent = bundle.silentMutuals[0];
  if (silent) {
    cards.push({
      id: "silent-forever",
      superlative: "Most likely to be a silent mutual forever",
      winnerLabel: formatAccountDisplayName(silent.displayName),
      winnerUsername: silent.username,
      caption: "Mutual follow, zero export interaction.",
      category: "Network",
      confidence: "medium",
      icon: "🤫",
    });
  }

  const searchTop = bundle.searchWrapped?.topAccounts[0];
  if (searchTop) {
    cards.push({
      id: "search",
      superlative: "Most likely to appear in your searches",
      winnerLabel: searchTop.query,
      caption: plural(searchTop.count, "search", "searches"),
      category: "Search",
      confidence: "high",
      icon: "🔍",
    });
  }

  // The export lists advertisers alphabetically with no ranking, so no single
  // advertiser is called out.
  const advertisersCount = parsed.ads?.advertisersCount ?? 0;
  if (advertisersCount > 0) {
    cards.push({
      id: "ad-target",
      superlative: "Most likely to be on advertisers' lists",
      winnerLabel: plural(advertisersCount, "advertiser"),
      caption: "Advertisers in your export that may have used your activity.",
      category: "Ads",
      confidence: "medium",
      icon: "📢",
    });
  }

  const realOne = bundle.realOnes[0];
  if (realOne) {
    cards.push({
      id: "sidekick",
      superlative: "Most likely to be your main character sidekick",
      winnerLabel: formatAccountDisplayName(realOne.displayName),
      winnerUsername: realOne.username,
      caption: `Real Ones score ${realOne.realOnesScore}`,
      category: "Network",
      confidence: "high",
      icon: "⭐",
    });
  }

  const randomMutual = bundle.cleanup.find(
    (c) => c.isMutual && c.dmMessageCount === 0
  );
  if (randomMutual) {
    cards.push({
      id: "random-mutual",
      superlative: "Most likely to be a random mutual forever",
      winnerLabel: formatAccountDisplayName(randomMutual.displayName),
      winnerUsername: randomMutual.username,
      caption: "No DMs, still mutual.",
      category: "Network",
      confidence: "medium",
      icon: "🎲",
    });
  }

  const balanced = bundle.dmAwards.find(
    (a) => a.id === "balanced" && isDmAwardMeaningful(a, threadSizes)
  );
  if (balanced) {
    cards.push({
      id: "revive",
      superlative: "Most likely to revive the chat after months",
      winnerLabel: balanced.threadLabel,
      caption: "Balanced long-running thread energy.",
      category: "DMs",
      confidence: "high",
      icon: "🔄",
    });
  }

  const oneSided = bundle.dmAwards.find(
    (a) => a.id === "one-sided" && isDmAwardMeaningful(a, threadSizes)
  );
  if (oneSided) {
    cards.push({
      id: "no-reply",
      superlative: "Most likely to carry the chat solo",
      winnerLabel: oneSided.threadLabel,
      caption: oneSided.description,
      category: "DMs",
      confidence: "medium",
      icon: "👀",
    });
  }

  return cards;
}
