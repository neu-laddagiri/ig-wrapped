"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Eye, Search } from "lucide-react";
import type { AdsPrivacyData } from "@/types/instagram";
import type { AdRoastResult, AdsPrivacyInsights, ContentDietResult } from "@/types/insights";
import type { DashboardTabId } from "@/components/DashboardTabs";
import { Modal } from "@/components/ig/Modal";
import { CANVAS_TONES, type CanvasTone } from "@/components/feed/Canvas";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { plural } from "@/lib/profileOwner";
import { usePresentationMode } from "@/contexts/PresentationContext";

interface ExploreViewProps {
  ads: AdsPrivacyData | null;
  adsInsights?: AdsPrivacyInsights | null;
  adRoast?: AdRoastResult | null;
  contentDiet?: ContentDietResult | null;
  onNavigate: (tab: DashboardTabId) => void;
}

type Sheet =
  | { kind: "theme"; theme: string; items: string[] }
  | { kind: "advertisers" }
  | { kind: "categories" }
  | null;

const THEME_EMOJI: Record<string, string> = {
  Lifestyle: "🌿",
  Shopping: "🛍️",
  Entertainment: "🎬",
  Fitness: "💪",
  Finance: "💸",
  Education: "📚",
  Travel: "✈️",
  Tech: "💻",
  Other: "✨",
};

const THEME_TONES: CanvasTone[] = ["pink", "purple", "orange", "magenta", "ink", "paper", "gradient"];

/**
 * Explore: what Instagram and its advertisers think you're into, as an
 * Instagram Explore grid. Each tile opens its full list.
 */
export function ExploreView({ ads, adsInsights, adRoast, contentDiet, onNavigate }: ExploreViewProps) {
  const { presentationMode } = usePresentationMode();
  const [sheet, setSheet] = useState<Sheet>(null);

  const themes = useMemo(
    () =>
      Object.entries(adRoast?.themedCategories ?? adsInsights?.themedCategories ?? {})
        .filter(([, items]) => items.length > 0)
        .sort((a, b) => b[1].length - a[1].length),
    [adRoast, adsInsights]
  );

  if (!ads) {
    return (
      <div className="py-20 text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 border-fg">
          <Eye className="h-10 w-10" strokeWidth={1.4} />
        </span>
        <p className="mt-4 text-xl">No ads data found</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-ig-muted">
          Files from <code>ads_information/</code> weren&apos;t in this export.
        </p>
      </div>
    );
  }

  const clickRate = ads.adsViewed > 0 ? ads.adsClicked / ads.adsViewed : 0;
  const tiles: ReactNode[] = [];

  tiles.push(
    <Tile key="roast" tone="yellow" tall label="Instagram thinks…">
      <p className="text-[11cqw] font-bold leading-[1.02] tracking-tight">
        “{adRoast?.roastLine ?? "Instagram has opinions about you."}”
      </p>
      {adRoast?.personality && (
        <p className="mt-[5cqw] text-[5.5cqw] font-semibold">Ad personality: {adRoast.personality}</p>
      )}
    </Tile>
  );

  themes.forEach(([theme, items], i) => {
    tiles.push(
      <Tile
        key={theme}
        tone={THEME_TONES[i % THEME_TONES.length]}
        label={theme}
        onClick={() => setSheet({ kind: "theme", theme, items })}
      >
        <p className="text-[18cqw] leading-none">{THEME_EMOJI[theme] ?? "✨"}</p>
        <p className="mt-[5cqw] text-[10cqw] font-bold leading-none">{formatNumber(items.length)}</p>
        <p className="mt-[2cqw] line-clamp-2 text-[6cqw] font-semibold leading-tight">
          {presentationMode ? `${theme} interests` : items.slice(0, 2).join(", ")}
        </p>
      </Tile>
    );
  });

  tiles.push(
    <Tile key="advertisers" tone="ink" label="Advertisers" onClick={() => setSheet({ kind: "advertisers" })}>
      <p className="text-[22cqw] font-bold leading-none tracking-tight">{formatNumber(ads.advertisersCount)}</p>
      <p className="mt-[3cqw] text-[6.5cqw] font-semibold leading-tight">
        {ads.advertisersCount === 1 ? "company had" : "companies had"} your info
      </p>
    </Tile>,
    <Tile key="seen" tone="paper" label="Ads seen">
      <p className="text-[20cqw] font-bold leading-none tracking-tight">{formatNumber(ads.adsViewed)}</p>
      <p className="mt-[3cqw] text-[6cqw] font-semibold leading-tight">
        ads seen · {plural(ads.adsClicked, "click")}
      </p>
      <p className="mt-[2cqw] text-[5cqw] opacity-70">{formatPercent(clickRate)} click rate</p>
    </Tile>
  );

  if (contentDiet) {
    tiles.push(
      <Tile key="diet" tone="purple" label="Your feed diet">
        <p className="text-[20cqw] font-bold leading-none tracking-tight">
          {Math.round(contentDiet.passiveRatio * 100)}%
        </p>
        <p className="mt-[3cqw] text-[6cqw] font-semibold leading-tight">watching, not posting</p>
        <p className="mt-[2cqw] line-clamp-2 text-[5cqw] opacity-85">{contentDiet.personality}</p>
      </Tile>
    );
  }

  if (ads.adCategories.length > 0) {
    tiles.push(
      <Tile key="categories" tone="gradient" label="Interest tags" onClick={() => setSheet({ kind: "categories" })}>
        <p className="text-[20cqw] font-bold leading-none tracking-tight">{formatNumber(ads.adCategoriesCount)}</p>
        <p className="mt-[3cqw] text-[6cqw] font-semibold leading-tight">interest tags on your account</p>
      </Tile>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => onNavigate("search")}
        className="mb-6 flex h-10 w-full items-center gap-2 rounded-lg bg-ig-secondary px-4 text-left text-sm text-ig-muted hover:bg-ig-hover"
      >
        <Search className="h-4 w-4" />
        Search — see what you looked up on Instagram
      </button>

      <ul className="grid grid-flow-row-dense grid-cols-3 gap-1">{tiles.map((tile, i) => <li key={i} className="contents">{tile}</li>)}</ul>

      <p className="mt-4 text-xs text-ig-muted">
        From Instagram&apos;s ads_information files. What&apos;s included depends on your export.
      </p>

      <Modal
        open={sheet !== null}
        onClose={() => setSheet(null)}
        size="sm"
        title={
          sheet?.kind === "theme"
            ? `${sheet.theme} interests`
            : sheet?.kind === "advertisers"
              ? "Advertisers"
              : "Interest tags"
        }
      >
        {sheet?.kind === "theme" && <ChipList items={sheet.items} hidden={presentationMode} noun="interest" />}
        {sheet?.kind === "categories" && <ChipList items={ads.adCategories} hidden={presentationMode} noun="interest tag" />}
        {sheet?.kind === "advertisers" && (
          <SearchableList items={ads.advertiserNames} hidden={presentationMode} noun="advertiser" />
        )}
      </Modal>
    </div>
  );
}

function Tile({
  tone,
  tall,
  label,
  onClick,
  children,
}: {
  tone: CanvasTone;
  tall?: boolean;
  label: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const body = (
    <span className="absolute inset-0 flex flex-col p-[8cqw] text-left" style={CANVAS_TONES[tone]}>
      <span className="text-[5cqw] font-semibold uppercase tracking-[0.12em] opacity-80">{label}</span>
      <span className="flex min-h-0 flex-1 flex-col justify-end">{children}</span>
    </span>
  );
  // The tile is the size container, so a tall tile's text scales with its width like the rest.
  const shape = `@container relative block w-full overflow-hidden ${tall ? "row-span-2 h-full min-h-full" : "aspect-square"}`;
  return onClick ? (
    <button type="button" onClick={onClick} className={`${shape} transition-opacity hover:opacity-90`}>
      {body}
    </button>
  ) : (
    <div className={shape}>{body}</div>
  );
}

function ChipList({ items, hidden, noun }: { items: string[]; hidden: boolean; noun: string }) {
  if (hidden) {
    return (
      <p className="px-6 py-10 text-center text-sm text-ig-muted">
        {plural(items.length, noun)} — hidden while presenting.
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-2 p-4">
      {items.map((item) => (
        <li key={item} className="rounded-lg bg-ig-secondary px-3 py-1.5 text-sm">
          {item}
        </li>
      ))}
    </ul>
  );
}

function SearchableList({ items, hidden, noun }: { items: string[]; hidden: boolean; noun: string }) {
  const [query, setQuery] = useState("");
  if (hidden) {
    return (
      <p className="px-6 py-10 text-center text-sm text-ig-muted">
        {plural(items.length, noun)} — names hidden while presenting.
      </p>
    );
  }
  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((n) => n.toLowerCase().includes(q)) : items;
  return (
    <div>
      <label className="relative mx-4 mt-3 flex items-center">
        <span className="sr-only">Search advertisers</span>
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-ig-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="h-9 w-full rounded-lg bg-ig-secondary pl-9 pr-3 text-sm outline-none placeholder:text-ig-muted"
        />
      </label>
      <ul className="max-h-[60vh] divide-y divide-ig-border overflow-y-auto px-4 py-2">
        {filtered.map((name) => (
          <li key={name} className="py-2.5 text-sm">
            {name}
          </li>
        ))}
        {filtered.length === 0 && <li className="py-8 text-center text-sm text-ig-muted">No matches.</li>}
      </ul>
    </div>
  );
}
