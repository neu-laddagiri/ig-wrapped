import type { InsightsBundle, YearbookCard } from "@/types/insights";
import type { ParsedExportData } from "@/types/instagram";
import { formatAccountDisplayName } from "@/lib/accountNameFilter";

export function computeYearbook(
  parsed: ParsedExportData,
  bundle: InsightsBundle
): YearbookCard[] {
  const cards: YearbookCard[] = [];

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
    .filter((a) => a.dmMessageCount > 20)
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
      caption: `${groupHero.totalMessages.toLocaleString()} messages`,
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
      caption: `${searchTop.count} searches`,
      category: "Search",
      confidence: "high",
      icon: "🔍",
    });
  }

  const adTarget = parsed.ads?.advertiserNames[0];
  if (adTarget) {
    cards.push({
      id: "ad-target",
      superlative: "Most likely to be Instagram's favorite ad target",
      winnerLabel: adTarget,
      caption: "Top advertiser in your export.",
      category: "Ads",
      confidence: "high",
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

  const balanced = bundle.dmAwards.find((a) => a.id === "balanced");
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

  const oneSided = bundle.dmAwards.find((a) => a.id === "one-sided");
  if (oneSided) {
    cards.push({
      id: "no-reply",
      superlative: "Most likely to never reply but still watch stories",
      winnerLabel: oneSided.threadLabel,
      caption: oneSided.description,
      category: "DMs",
      confidence: "medium",
      icon: "👀",
    });
  }

  return cards;
}
