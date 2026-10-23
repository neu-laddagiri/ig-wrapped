"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Bookmark, Grid3x3, Heart, SquareUser } from "lucide-react";
import type { ParsedExportData } from "@/types/instagram";
import type { EraLabel, InsightsBundle } from "@/types/insights";
import type { DashboardTabId } from "@/components/DashboardTabs";
import type { FollowListTab } from "@/components/profile/FollowListModal";
import { Avatar, StoryRing } from "@/components/ig/Avatar";
import { Modal } from "@/components/ig/Modal";
import { Post } from "@/components/ig/Post";
import { Canvas, CanvasNote, CANVAS_TONES, type CanvasTone } from "@/components/feed/Canvas";
import { StoryViewerModal, type StorySlide } from "@/components/StoryModeModal";
import { formatNumber } from "@/lib/formatters";
import { redactNameLabel } from "@/lib/dmDisplayLabels";
import { resolveProfileOwner } from "@/lib/profileOwner";

type ProfileTab = "profile" | "people" | "saved";

interface ProfileViewProps {
  tab: ProfileTab;
  onTabChange: (tab: DashboardTabId) => void;
  data: ParsedExportData;
  insights: InsightsBundle;
  showNames: boolean;
  onOpenStory: () => void;
  onShare: () => void;
  onOpenFollowList: (tab: FollowListTab) => void;
  onToast: (message: string) => void;
  /** Leaderboards, Real Ones and cleanup. */
  peopleContent: ReactNode;
  /** Cloud save panel and saved analyses (or the presenting guard). */
  savedContent: ReactNode;
}

interface GridItem {
  id: string;
  tone: CanvasTone;
  icon?: string;
  title: string;
  winner: string;
  caption: string;
  category: string;
}

const GRID_TONES: CanvasTone[] = ["paper", "purple", "pink", "yellow", "magenta", "orange", "ink"];

export function ProfileView({
  tab,
  onTabChange,
  data,
  insights,
  showNames,
  onOpenStory,
  onShare,
  onOpenFollowList,
  onToast,
  peopleContent,
  savedContent,
}: ProfileViewProps) {
  const owner = resolveProfileOwner(insights, showNames);
  const network = data.network;
  const [openItem, setOpenItem] = useState<GridItem | null>(null);
  const [eraIndex, setEraIndex] = useState<number | null>(null);

  const grid = useMemo((): GridItem[] => {
    const items: GridItem[] = (insights.yearbook ?? [])
      .filter((card) => showNames || card.category !== "Search")
      .map((card, i) => ({
        id: card.id,
        tone: GRID_TONES[i % GRID_TONES.length],
        icon: card.icon,
        title: card.superlative,
        winner: redactNameLabel(card.winnerLabel, showNames),
        caption: card.caption,
        category: card.category,
      }));
    for (const award of insights.hallOfFame ?? []) {
      if (items.length >= 15) break;
      items.push({
        id: `hof-${award.id}`,
        tone: award.category === "shame" ? "ink" : "gradient",
        icon: award.category === "shame" ? "🫣" : "🏆",
        title: award.title,
        winner: redactNameLabel(award.winnerLabel, showNames),
        caption: award.why,
        category: award.category === "shame" ? "Hall of shame" : "Hall of fame",
      });
    }
    return items;
  }, [insights.yearbook, insights.hallOfFame, showNames]);

  const eras = useMemo(
    () => [...(insights.eras?.eraLabels ?? [])].sort((a, b) => a.month.localeCompare(b.month)).slice(-10),
    [insights.eras]
  );
  const eraSlides = useMemo(() => eras.map(eraSlide), [eras]);

  const stats: { tab: FollowListTab; value: number; label: string }[] = network
    ? [
        { tab: "followers", value: network.totalFollowers, label: "followers" },
        { tab: "following", value: network.totalFollowing, label: "following" },
        { tab: "mutuals", value: network.mutuals.length, label: "mutuals" },
      ]
    : [];

  const personality = insights.personality;
  const scoreboard = insights.wrappedScoreboard;
  const peak = insights.eras?.peakMonth;

  return (
    <div className="mx-auto max-w-[935px] px-4 pb-16 pt-6 sm:pt-10">
      <header className="flex gap-6 sm:gap-20 sm:px-8">
        <button
          type="button"
          onClick={onOpenStory}
          aria-label="Watch your Wrapped story"
          className="shrink-0 self-start sm:mx-6"
        >
          <StoryRing pad={6}>
            <span className="flex sm:hidden">
              <Avatar size={77} />
            </span>
            <span className="hidden sm:flex">
              <Avatar size={150} />
            </span>
          </StoryRing>
        </button>

        <div className="min-w-0 flex-1 space-y-4 sm:space-y-5">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="mr-2 truncate text-xl font-normal">{owner.handle}</h1>
            <button type="button" onClick={onOpenStory} className="rounded-lg bg-ig-secondary px-4 py-1.5 text-sm font-semibold hover:bg-ig-hover">
              Watch Wrapped
            </button>
            <button type="button" onClick={onShare} className="rounded-lg bg-ig-secondary px-4 py-1.5 text-sm font-semibold hover:bg-ig-hover">
              Share card
            </button>
          </div>

          {stats.length > 0 && (
            <ul className="hidden gap-10 text-base sm:flex">
              {stats.map((s) => (
                <li key={s.tab}>
                  <button type="button" onClick={() => onOpenFollowList(s.tab)} className="hover:opacity-70">
                    <span className="font-semibold">{formatNumber(s.value)}</span> {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="hidden text-sm leading-5 sm:block">
            <Bio
              name={owner.name}
              personality={personality?.title}
              description={personality?.description}
              peak={peak?.label}
              health={scoreboard ? `${scoreboard.overallHealth}/100` : undefined}
            />
          </div>
        </div>
      </header>

      <div className="mt-4 text-sm leading-5 sm:hidden">
        <Bio
          name={owner.name}
          personality={personality?.title}
          description={personality?.description}
          peak={peak?.label}
          health={scoreboard ? `${scoreboard.overallHealth}/100` : undefined}
        />
      </div>

      {eras.length > 0 && (
        <div className="no-scrollbar mt-8 flex gap-4 overflow-x-auto pb-2 sm:mt-11 sm:gap-11 sm:px-8">
          {eras.map((era, i) => (
            <button
              key={era.month}
              type="button"
              onClick={() => setEraIndex(i)}
              className="flex w-[64px] shrink-0 flex-col items-center gap-2 sm:w-[87px]"
              aria-label={`Open era: ${era.label}, ${era.monthLabel ?? era.month}`}
            >
              <span className="rounded-full p-[3px] ring-1 ring-ig-border">
                <EraCover era={era} index={i} />
              </span>
              <span className="w-full truncate text-center text-xs font-semibold">{era.label}</span>
            </button>
          ))}
        </div>
      )}

      {stats.length > 0 && (
        <ul className="mt-6 grid grid-cols-3 border-t border-ig-border py-3 text-center text-sm sm:hidden">
          {stats.map((s) => (
            <li key={s.tab}>
              <button type="button" onClick={() => onOpenFollowList(s.tab)} className="w-full leading-tight">
                <span className="block font-semibold">{formatNumber(s.value)}</span>
                <span className="text-ig-muted">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="Profile sections" className="mt-2 flex justify-center gap-14 border-t border-ig-border sm:mt-10">
        <TabButton icon={Grid3x3} label="Posts" active={tab === "profile"} onClick={() => onTabChange("profile")} />
        <TabButton icon={SquareUser} label="People" active={tab === "people"} onClick={() => onTabChange("people")} />
        <TabButton icon={Bookmark} label="Saved" active={tab === "saved"} onClick={() => onTabChange("saved")} />
      </nav>

      <div className="mt-1">
        {tab === "profile" &&
          (grid.length ? (
            <ul className="grid grid-cols-3 gap-[3px] sm:gap-1">
              {grid.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setOpenItem(item)}
                    className="group @container relative block aspect-square w-full overflow-hidden"
                    style={CANVAS_TONES[item.tone]}
                    aria-label={`${item.title}: ${item.winner}`}
                  >
                    <span className="absolute inset-0 flex flex-col items-start justify-end p-[8cqw] text-left">
                      {item.icon && <span className="text-[16cqw] leading-none">{item.icon}</span>}
                      <span className="mt-[4cqw] line-clamp-3 text-[9cqw] font-bold leading-[1.05] tracking-tight">
                        {item.title}
                      </span>
                    </span>
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 p-[8cqw] text-center text-[8cqw] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                      <Heart className="mr-[3cqw] h-[9cqw] w-[9cqw] shrink-0 fill-white" />
                      <span className="line-clamp-2">{item.winner}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyTab
              icon={Grid3x3}
              title="No posts yet"
              text="Superlatives appear here once your export has enough activity."
            />
          ))}
        {tab === "people" && <div className="pt-6">{peopleContent}</div>}
        {tab === "saved" && <div className="pt-6">{savedContent}</div>}
      </div>

      <Modal open={Boolean(openItem)} onClose={() => setOpenItem(null)} title={openItem?.category ?? "Post"} size="sm" bodyClassName="p-4">
        {openItem && (
          <Post
            subtitle={openItem.category}
            mediaLabel={openItem.title}
            slides={[
              <Canvas key={openItem.id} tone={openItem.tone} label={openItem.category}>
                {openItem.icon && <p className="text-[13cqw] leading-none">{openItem.icon}</p>}
                <p className="mt-[4cqw] text-[8.5cqw] font-bold leading-[1.02] tracking-tight">{openItem.title}</p>
                <p className="mt-[3cqw] text-[5.4cqw] font-semibold opacity-90">{openItem.winner}</p>
              </Canvas>,
            ]}
            caption={openItem.caption}
            shareText={`${openItem.title} — ${openItem.winner}. ${openItem.caption}`}
            onToast={onToast}
          />
        )}
      </Modal>

      <StoryViewerModal
        open={eraIndex !== null}
        onClose={() => setEraIndex(null)}
        slides={eraSlides}
        startIndex={eraIndex ?? 0}
      />
    </div>
  );
}

function Bio({
  name,
  personality,
  description,
  peak,
  health,
}: {
  name: string | null;
  personality?: string;
  description?: string;
  peak?: string;
  health?: string;
}) {
  return (
    <div className="space-y-0.5">
      {name && <p className="font-semibold">{name}</p>}
      {personality && <p className="text-ig-muted">{personality}</p>}
      {description && <p>{description}</p>}
      {peak && <p>📅 Peak era: {peak}</p>}
      {health && <p>💚 IG health {health}</p>}
      <p className="font-semibold text-ig-link">Parsed in your browser · never uploaded</p>
    </div>
  );
}

function TabButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Grid3x3;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`-mt-px flex h-[52px] items-center gap-1.5 border-t text-xs font-semibold uppercase tracking-[0.1em] ${
        active ? "border-fg text-fg" : "border-transparent text-ig-muted hover:text-fg"
      }`}
    >
      <Icon className="h-6 w-6 sm:h-3 sm:w-3" strokeWidth={2.5} />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </button>
  );
}

function EmptyTab({ icon: Icon, title, text }: { icon: typeof Grid3x3; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-fg">
        <Icon className="h-8 w-8" strokeWidth={1.5} />
      </span>
      <p className="mt-4 text-2xl font-extrabold">{title}</p>
      <p className="mt-2 max-w-sm text-sm text-ig-muted">{text}</p>
    </div>
  );
}

const ERA_TONES: CanvasTone[] = ["pink", "purple", "orange", "magenta", "yellow", "ink"];

function EraCover({ era, index }: { era: EraLabel; index: number }) {
  const [month, year] = (era.monthLabel ?? era.month).split(" ");
  const tone = CANVAS_TONES[ERA_TONES[index % ERA_TONES.length]];
  return (
    <span
      className="flex h-14 w-14 flex-col items-center justify-center rounded-full leading-none sm:h-[77px] sm:w-[77px]"
      style={tone}
      aria-hidden
    >
      <span className="text-sm font-bold sm:text-base">{month?.slice(0, 3)}</span>
      {year && <span className="mt-0.5 text-[10px] font-semibold opacity-80 sm:text-xs">{year}</span>}
    </span>
  );
}

function eraSlide(era: EraLabel, index: number): StorySlide {
  const lines = (era.breakdown ?? []).slice(0, 3);
  return {
    id: `era-${era.month}`,
    tone: ERA_TONES[index % ERA_TONES.length],
    label: era.monthLabel ?? era.month,
    body: (
      <>
        <p className="text-[6cqw] font-semibold opacity-85">{era.monthLabel ?? era.month}</p>
        <p className="mt-[2cqw] text-[13cqw] font-bold leading-[0.95] tracking-tight">{era.label}</p>
        <CanvasNote>{era.dominanceLine ?? era.caption}</CanvasNote>
        {lines.length > 0 && (
          <ul className="mt-[6cqw] space-y-[2cqw] text-[5cqw]">
            {lines.map((line) => (
              <li key={line.label} className="flex justify-between gap-4 border-b border-current/20 pb-[2cqw]">
                <span>{line.label}</span>
                <span className="font-bold tabular-nums">{formatNumber(line.count)}</span>
              </li>
            ))}
          </ul>
        )}
      </>
    ),
    seconds: 5,
  };
}
