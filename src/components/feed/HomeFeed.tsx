"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Megaphone,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { MostActiveEraData, ParsedExportData } from "@/types/instagram";
import type { InsightsBundle } from "@/types/insights";
import type { DashboardTabId } from "@/components/DashboardTabs";
import type { StoryChapter } from "@/components/StoryModeModal";
import type { FollowListTab } from "@/components/profile/FollowListModal";
import { Post } from "@/components/ig/Post";
import { Avatar, IconAvatar, StoryRing, type RingState } from "@/components/ig/Avatar";
import { NOT_AFFILIATED } from "@/components/ig/Logo";
import { Canvas, CanvasAvatar, CanvasNote, HeroNumber } from "@/components/feed/Canvas";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { redactNameLabel, resolveDmAwardLabel } from "@/lib/dmDisplayLabels";
import { plural, resolveProfileOwner } from "@/lib/profileOwner";

interface HomeFeedProps {
  data: ParsedExportData;
  insights: InsightsBundle;
  mostActiveEra: MostActiveEraData | null;
  /** False while presenting: every person name and handle is masked. */
  showNames: boolean;
  onOpenStory: (chapter?: StoryChapter) => void;
  onOpenFollowList: (tab: FollowListTab) => void;
  onNavigate: (tab: DashboardTabId) => void;
  onOpenAccount: (username: string) => void;
  /** Opens the AI chat; omitted while presenting. */
  onAsk?: () => void;
  onShare: () => void;
  onCreate: () => void;
  onToast: (message: string) => void;
  /** Optional AI recap card, rendered at the end of the feed. */
  aiRecap?: ReactNode;
  /** Notices (demo, presentation, parse errors) shown above the stories. */
  notices?: ReactNode;
}

interface StoryItem {
  id: StoryChapter;
  label: string;
  cover: ReactNode;
}

export function HomeFeed({
  data,
  insights,
  mostActiveEra,
  showNames,
  onOpenStory,
  onOpenFollowList,
  onNavigate,
  onOpenAccount,
  onAsk,
  onShare,
  onCreate,
  onToast,
  aiRecap,
  notices,
}: HomeFeedProps) {
  const owner = resolveProfileOwner(insights, showNames);
  const { network, wrapped, messages, ads, security } = data;

  const stories: StoryItem[] = [
    { id: "welcome", label: "Wrapped", cover: <Avatar size={56} /> },
    ...(network ? [{ id: "network" as const, label: "Network", cover: <IconAvatar icon={Users} /> }] : []),
    ...(messages ? [{ id: "dms" as const, label: "DMs", cover: <IconAvatar icon={MessageCircle} /> }] : []),
    ...(mostActiveEra ? [{ id: "era" as const, label: "Peak era", cover: <IconAvatar icon={CalendarDays} /> }] : []),
    ...(ads ? [{ id: "ads" as const, label: "Ads", cover: <IconAvatar icon={Megaphone} /> }] : []),
    ...(security ? [{ id: "security" as const, label: "Security", cover: <IconAvatar icon={ShieldCheck} /> }] : []),
    ...(insights.personality
      ? [{ id: "personality" as const, label: "Personality", cover: <IconAvatar icon={Sparkles} /> }]
      : []),
  ];

  const posts: ReactNode[] = [];
  const recap = buildRecapSlides(data, insights, owner.handle);
  if (recap.length) {
    posts.push(
      <Post
        key="recap"
        subtitle="Your year on Instagram"
        slides={recap}
        mediaLabel="Your Instagram Wrapped, in slides"
        highlight={wrapped ? `${formatNumber(wrapped.likedPosts)} likes given` : undefined}
        caption={
          insights.wrappedScoreboard?.verdict ??
          insights.personality?.description ??
          "Your export, decoded. Swipe through the highlights."
        }
        viewAll={{ label: "Watch your Wrapped story", onClick: () => onOpenStory("welcome") }}
        onAsk={onAsk}
        onShareClick={onShare}
        onToast={onToast}
      />
    );
  }

  if (network && network.totalFollowing > 0) {
    const notBack = network.dontFollowMeBack.length;
    const fans = network.iDontFollowBack.length;
    posts.push(
      <Post
        key="not-back"
        subtitle="Your network"
        mediaLabel={`${plural(notBack, "account")} you follow ${notBack === 1 ? "doesn't" : "don't"} follow you back`}
        slides={[
          <Canvas key="n" tone="pink" label="Not following you back">
            <HeroNumber
              value={formatNumber(notBack)}
              caption={notBack === 1 ? "account you follow doesn't follow you back" : "accounts you follow don't follow you back"}
            />
            {notBack > 0 && (
              <div className="mt-[6cqw] flex items-center">
                {Array.from({ length: Math.min(5, notBack) }, (_, i) => (
                  <span key={i} className={i ? "-ml-[2.5cqw]" : ""}>
                    <CanvasAvatar size="11cqw" />
                  </span>
                ))}
                {notBack > 5 && (
                  <span className="ml-[3cqw] text-[4.4cqw] font-semibold">
                    +{formatNumber(notBack - 5)}
                  </span>
                )}
              </div>
            )}
          </Canvas>,
        ]}
        highlight={`${formatPercent(network.followBackRatio)} follow-back rate`}
        caption={`You follow ${plural(network.totalFollowing, "account")} and ${formatNumber(network.mutuals.length)} follow you back. ${
          fans > 0 ? `${plural(fans, "fan")} ${fans === 1 ? "follows" : "follow"} you without a follow-back from you.` : ""
        }`.trim()}
        viewAll={
          notBack > 0
            ? { label: notBack === 1 ? "View the 1 account" : `View all ${formatNumber(notBack)} accounts`, onClick: () => onOpenFollowList("notFollowingBack") }
            : { label: "View who you follow", onClick: () => onOpenFollowList("following") }
        }
        onAsk={onAsk}
        shareText={`${notBack} of the ${network.totalFollowing} accounts I follow don't follow me back 👀 — via IG Wrapped`}
        onToast={onToast}
      />
    );
  }

  const realOnes = insights.realOnes.slice(0, 3);
  if (realOnes.length) {
    posts.push(
      <Post
        key="real-ones"
        subtitle="Your people"
        mediaLabel="Your top three Real Ones"
        slides={[
          <Canvas key="r" tone="purple" label="Your Real Ones">
            <p className="mb-[6cqw] text-[8cqw] font-bold leading-none tracking-tight">
              The ones who
              <br />
              actually show up.
            </p>
            <ol className="grid grid-cols-3 items-end gap-[3cqw]">
              {realOnes.map((person, i) => (
                <li
                  key={person.username}
                  // Podium order: #2, #1, #3.
                  style={{ order: i === 0 ? 2 : i === 1 ? 1 : 3 }}
                  className="flex min-w-0 flex-col items-center text-center"
                >
                  <span className="relative">
                    <CanvasAvatar size={i === 0 ? "19cqw" : "15cqw"} />
                    <span className="absolute -bottom-[1cqw] -right-[1cqw] flex h-[6.5cqw] w-[6.5cqw] items-center justify-center rounded-full bg-white text-[3.6cqw] font-bold text-[#7638fa]">
                      {i + 1}
                    </span>
                  </span>
                  <span className="mt-[2.5cqw] w-full truncate text-[3.8cqw] font-semibold">
                    {redactNameLabel(person.displayName || person.username, showNames)}
                  </span>
                  <span className="text-[3.2cqw] opacity-80">
                    {plural(person.dmMessageCount + person.groupMessageCount, "message")}
                  </span>
                </li>
              ))}
            </ol>
          </Canvas>,
        ]}
        caption={`${redactNameLabel(realOnes[0].displayName || realOnes[0].username, showNames)} is your #1${
          realOnes[0].rankReason ? ` (${realOnes[0].rankReason})` : ""
        }. Ranked from DMs, mutual follows and interactions in your export.`}
        viewAll={{ label: "See all your Real Ones", onClick: () => onNavigate("people") }}
        onAsk={onAsk}
        onToast={onToast}
      />
    );
  }

  const eraPost = buildEraPost(mostActiveEra, insights);
  if (eraPost) {
    posts.push(
      <Post
        key="era"
        subtitle="Your timeline"
        mediaLabel={`Your most active month was ${eraPost.month}`}
        slides={[eraPost.slide]}
        highlight={`${formatNumber(eraPost.count)} things you did that month`}
        caption={eraPost.caption}
        viewAll={{ label: "See your full timeline", onClick: () => onNavigate("eras") }}
        onAsk={onAsk}
        shareText={`My Instagram peak era: ${eraPost.month} — via IG Wrapped`}
        onToast={onToast}
      />
    );
  }

  const roast = insights.adRoast;
  if (ads && (roast || ads.advertisersCount > 0)) {
    const themes = topAdThemes(roast?.themedCategories ?? insights.adsInsights?.themedCategories);
    posts.push(
      <Post
        key="ads"
        subtitle="Ads & interests"
        mediaLabel="What Instagram's ad profile says about you"
        slides={[
          <Canvas key="a" tone="yellow" label="What Instagram thinks you're into">
            <p className="text-[9cqw] font-bold leading-[1.02] tracking-tight">
              “{roast?.roastLine ?? "Instagram has opinions about you."}”
            </p>
            {themes.length > 0 && (
              <div className="mt-[6cqw] flex flex-wrap gap-[2cqw]">
                {themes.map((theme) => (
                  <span key={theme} className="rounded-full border-[0.5cqw] border-black px-[3.5cqw] py-[1.2cqw] text-[3.8cqw] font-semibold">
                    {theme}
                  </span>
                ))}
              </div>
            )}
          </Canvas>,
        ]}
        highlight={`${plural(ads.advertisersCount, "advertiser")} had your info`}
        caption={roast?.fbiNotes ?? insights.adsInsights?.summary ?? "Here's what advertisers learned from your activity."}
        viewAll={{ label: "Explore your ad interests", onClick: () => onNavigate("explore") }}
        onAsk={onAsk}
        shareText={`Instagram's ad profile on me: “${roast?.roastLine ?? "Instagram has opinions about you."}” — via IG Wrapped`}
        onToast={onToast}
      />
    );
  }

  const awards = insights.dmAwards.slice(0, 5);
  if (messages && (awards.length || messages.totalMessages > 0)) {
    posts.push(
      <Post
        key="dms"
        subtitle="Your messages"
        mediaLabel="Your DM awards"
        slides={
          awards.length
            ? awards.map((award) => (
                <Canvas key={award.id} tone="magenta" label="DM awards">
                  <p className="text-[4.6cqw] font-semibold uppercase tracking-[0.12em] opacity-85">
                    {award.title}
                  </p>
                  <p className="mt-[3cqw] text-[11cqw] font-bold leading-[0.95] tracking-tight">
                    {resolveDmAwardLabel(award, showNames)}
                  </p>
                  <CanvasNote>{award.description}</CanvasNote>
                </Canvas>
              ))
            : [
                <Canvas key="m" tone="magenta" label="Your messages">
                  <HeroNumber value={formatNumber(messages.totalMessages)} caption="messages in your inbox" />
                </Canvas>,
              ]
        }
        highlight={plural(messages.totalMessages, "message")}
        caption={`Across ${plural(messages.oneOnOneCount, "chat")} and ${plural(messages.groupChatCount, "group chat")}.`}
        viewAll={{ label: "Open your messages", onClick: () => onNavigate("messages") }}
        onAsk={onAsk}
        onToast={onToast}
      />
    );
  }

  const yearbook = (insights.yearbook ?? [])
    .filter((card) => showNames || card.category !== "Search")
    .slice(0, 6);
  if (yearbook.length) {
    posts.push(
      <Post
        key="yearbook"
        subtitle="Yearbook"
        mediaLabel="Your Instagram yearbook superlatives"
        slides={yearbook.map((card) => (
          <Canvas key={card.id} tone="paper" label={`Yearbook · ${card.category}`}>
            {card.icon && <p className="text-[13cqw] leading-none">{card.icon}</p>}
            <p className="mt-[4cqw] text-[8.5cqw] font-bold leading-[1.02] tracking-tight">
              {card.superlative}
            </p>
            <p className="mt-[3cqw] text-[5cqw] font-semibold text-[#d62976]">
              {redactNameLabel(card.winnerLabel, showNames)}
            </p>
            <CanvasNote>{card.caption}</CanvasNote>
          </Canvas>
        ))}
        caption="Superlatives, voted on by your own data."
        viewAll={{ label: "See all superlatives", onClick: () => onNavigate("profile") }}
        onAsk={onAsk}
        onToast={onToast}
      />
    );
  }

  if (security) {
    const flagged = security.suspiciousLoginAnalysis?.flaggedEvents.length ?? 0;
    const devices = new Set(
      (security.events ?? []).filter((e) => e.type === "login" && e.device).map((e) => e.device)
    ).size;
    const score = insights.securityAudit?.healthScore ?? security.suspiciousLoginAnalysis?.securityScore;
    posts.push(
      <Post
        key="security"
        subtitle="Security check-up"
        mediaLabel="Your account security check-up"
        slides={[
          <Canvas key="s" tone="ink" label="Security check-up">
            {score !== undefined ? (
              <div className="flex items-end gap-[2cqw]">
                <span className="text-[30cqw] font-bold leading-[0.85] tracking-[-0.05em]">{score}</span>
                <span className="mb-[3cqw] text-[6cqw] font-semibold opacity-70">/100</span>
              </div>
            ) : (
              <ShieldCheck className="h-[24cqw] w-[24cqw]" strokeWidth={1.5} />
            )}
            <div className="mt-[6cqw] grid grid-cols-3 gap-[3cqw] text-[3.8cqw]">
              <Stat value={formatNumber(security.loginCount)} label={security.loginCount === 1 ? "login" : "logins"} />
              <Stat value={formatNumber(devices)} label={devices === 1 ? "device" : "devices"} />
              <Stat value={formatNumber(flagged)} label="to review" accent={flagged > 0} />
            </div>
          </Canvas>,
        ]}
        caption={
          flagged > 0
            ? `${plural(flagged, "login")} looked unusual. Worth a quick look.`
            : insights.securityAudit?.suggestions[0] ?? "No unusual logins stood out in your export."
        }
        viewAll={{ label: "Review login activity", onClick: () => onNavigate("activity") }}
        onAsk={onAsk}
        onToast={onToast}
      />
    );
  }

  return (
    <div className="flex justify-center gap-16 px-0 pt-4 sm:pt-8">
      <div className="w-full max-w-[630px]">
        {notices}
        <StoriesTray stories={stories} onOpen={onOpenStory} />
        <div className="mx-auto mt-6 flex max-w-[470px] flex-col gap-5 px-3 sm:px-0">
          {posts.length ? posts : (
            <p className="py-16 text-center text-sm text-ig-muted">
              This export doesn&apos;t include enough data for highlights yet.
            </p>
          )}
          {aiRecap}
          <p className="pb-8 pt-2 text-center text-sm text-ig-muted">
            You&apos;re all caught up
          </p>
        </div>
      </div>

      <aside className="hidden w-[319px] shrink-0 pt-6 xl:block">
        <RightRail
          ownerHandle={owner.handle}
          ownerName={owner.name}
          data={data}
          showNames={showNames}
          onCreate={onCreate}
          onOpenFollowList={onOpenFollowList}
          onOpenAccount={onOpenAccount}
          onNavigate={onNavigate}
        />
      </aside>
    </div>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <p className={`text-[7.5cqw] font-bold leading-none ${accent ? "text-[#ff7a00]" : ""}`}>{value}</p>
      <p className="mt-[1cqw] opacity-70">{label}</p>
    </div>
  );
}

function StoriesTray({
  stories,
  onOpen,
}: {
  stories: StoryItem[];
  onOpen: (chapter: StoryChapter) => void;
}) {
  const [seen, setSeen] = useState<Set<StoryChapter>>(() => new Set());
  const [loading, setLoading] = useState<StoryChapter | null>(null);

  // A short spin on the ring before opening, like Instagram loading a story.
  const open = (id: StoryChapter) => {
    if (loading) return;
    setLoading(id);
    window.setTimeout(() => {
      setLoading(null);
      setSeen((prev) => new Set(prev).add(id));
      onOpen(id);
    }, 550);
  };

  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto px-3 pb-2 sm:px-0">
      {stories.map((story) => {
        const state: RingState = loading === story.id ? "loading" : seen.has(story.id) ? "seen" : "unseen";
        return (
          <button
            key={story.id}
            type="button"
            onClick={() => open(story.id)}
            className="flex w-[74px] shrink-0 flex-col items-center gap-1.5"
            aria-label={`Open story: ${story.label}`}
          >
            <StoryRing state={state} pad={5}>
              {story.cover}
            </StoryRing>
            <span className="w-full truncate text-center text-xs text-fg">{story.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function RightRail({
  ownerHandle,
  ownerName,
  data,
  showNames,
  onCreate,
  onOpenFollowList,
  onOpenAccount,
  onNavigate,
}: {
  ownerHandle: string;
  ownerName: string | null;
  data: ParsedExportData;
  showNames: boolean;
  onCreate: () => void;
  onOpenFollowList: (tab: FollowListTab) => void;
  onOpenAccount: (username: string) => void;
  onNavigate: (tab: DashboardTabId) => void;
}) {
  const suggestions = useMemo(
    () => (data.network?.dontFollowMeBack ?? []).slice(0, 5),
    [data.network]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 px-1">
        <button type="button" onClick={() => onNavigate("profile")} aria-label="Open your profile">
          <Avatar size={44} />
        </button>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold">{ownerHandle}</p>
          <p className="truncate text-sm text-ig-muted">{ownerName ?? "Your export"}</p>
        </div>
        <button type="button" onClick={onCreate} className="text-xs font-semibold text-ig-blue hover:text-ig-link">
          Switch
        </button>
      </div>

      {suggestions.length > 0 && (
        <section aria-label="Not following you back">
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="text-sm font-semibold text-ig-muted">Not following you back</p>
            <button
              type="button"
              onClick={() => onOpenFollowList("notFollowingBack")}
              className="text-xs font-semibold text-fg hover:text-ig-muted"
            >
              See All
            </button>
          </div>
          <ul className="space-y-3">
            {suggestions.map((account, i) => (
              <li key={account.username} className="flex items-center gap-3 px-1">
                <Avatar size={44} />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-semibold">
                    {showNames ? account.displayUsername || account.username : `Account ${i + 1}`}
                  </p>
                  <p className="truncate text-xs text-ig-muted">You follow them</p>
                </div>
                {showNames && (
                  <button
                    type="button"
                    onClick={() => onOpenAccount(account.username)}
                    className="text-xs font-semibold text-ig-blue hover:text-ig-link"
                  >
                    View
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="space-y-3 px-1 text-xs text-ig-muted">
        <p className="leading-5">
          <button type="button" onClick={() => onNavigate("saved")} className="hover:underline">Saved</button>
          {" · "}
          <button type="button" onClick={() => onNavigate("actionplan")} className="hover:underline">Action plan</button>
          {" · "}
          <button type="button" onClick={() => onNavigate("export")} className="hover:underline">Download CSVs</button>
          {" · "}
          <button type="button" onClick={() => onNavigate("explorer")} className="hover:underline">Data explorer</button>
        </p>
        <p className="uppercase leading-5">
          © {new Date().getFullYear()} IG Wrapped · Parsed in your browser
        </p>
        <p className="leading-5">{NOT_AFFILIATED}</p>
      </footer>
    </div>
  );
}

function buildRecapSlides(
  data: ParsedExportData,
  insights: InsightsBundle,
  handle: string
): ReactNode[] {
  const { network, wrapped, messages } = data;
  const slides: ReactNode[] = [
    <Canvas key="cover" tone="gradient" label="Your Instagram" footer={<span>@{handle} · swipe →</span>}>
      <p className="text-[10cqw] font-bold leading-none tracking-tight">Your Instagram,</p>
      <p className="font-logo text-[27cqw] leading-[0.9]">Wrapped</p>
    </Canvas>,
  ];

  if (network) {
    slides.push(
      <Canvas key="network" tone="purple" label="Your circle">
        <div className="grid grid-cols-3 gap-[3cqw]">
          {[
            [network.totalFollowers, "followers"],
            [network.totalFollowing, "following"],
            [network.mutuals.length, "mutuals"],
          ].map(([value, label]) => (
            <div key={label as string}>
              <p className="text-[13cqw] font-bold leading-none tracking-tight tabular-nums">
                {formatNumber(value as number)}
              </p>
              <p className="mt-[1.5cqw] text-[4.4cqw] font-semibold opacity-85">{label}</p>
            </div>
          ))}
        </div>
        <CanvasNote>
          {formatPercent(network.followBackRatio)} of the people you follow follow you back.
        </CanvasNote>
      </Canvas>
    );
  }

  if (wrapped && wrapped.likedPosts > 0) {
    slides.push(
      <Canvas key="likes" tone="pink" label="Double taps">
        <HeroNumber value={formatNumber(wrapped.likedPosts)} caption="posts you liked" />
        <CanvasNote>
          {plural(wrapped.postComments, "comment")} written · {plural(wrapped.savedPosts, "post")} saved
        </CanvasNote>
      </Canvas>
    );
  }

  if (wrapped && wrapped.storiesViewed > 0) {
    slides.push(
      <Canvas key="stories" tone="orange" label="Stories">
        <HeroNumber value={formatNumber(wrapped.storiesViewed)} caption="stories you watched" />
        {wrapped.storyLikes > 0 && <CanvasNote>{plural(wrapped.storyLikes, "story like")} sent</CanvasNote>}
      </Canvas>
    );
  }

  if (messages && messages.totalMessages > 0) {
    slides.push(
      <Canvas key="dms" tone="magenta" label="Messages">
        <HeroNumber value={formatNumber(messages.totalMessages)} caption="messages in your DMs" />
        <CanvasNote>
          {plural(messages.oneOnOneCount, "chat")} · {plural(messages.groupChatCount, "group chat")}
        </CanvasNote>
      </Canvas>
    );
  }

  if (insights.personality) {
    slides.push(
      <Canvas key="you" tone="ink" label="Your personality">
        <p className="text-[6cqw] font-semibold opacity-80">You&apos;re</p>
        <p className="text-ig-gradient mt-[1cqw] text-[13cqw] font-bold leading-[0.95] tracking-tight">
          {insights.personality.title}
        </p>
        <CanvasNote>{insights.personality.description}</CanvasNote>
      </Canvas>
    );
  }

  return slides.length > 1 ? slides : [];
}

function buildEraPost(era: MostActiveEraData | null, insights: InsightsBundle) {
  if (!era || era.mostActiveMonthCount <= 0) return null;
  const eraLabel = insights.eras?.eraLabels.find((l) => l.month === era.mostActiveMonth);
  const months = era.monthlyTotals.slice(-12);
  const max = Math.max(1, ...months.map((m) => m.count));

  return {
    month: era.mostActiveMonthLabel,
    count: era.mostActiveMonthCount,
    caption:
      eraLabel?.dominanceLine ??
      eraLabel?.caption ??
      era.topActivityCaption ??
      "Your busiest month, counted from every dated action in your export.",
    slide: (
      <Canvas key="era" tone="orange" label="Your peak era">
        <p className="text-[6cqw] font-semibold opacity-90">{eraLabel?.label ?? "Peak era"}</p>
        <p className="mt-[1cqw] text-[12cqw] font-bold leading-[0.95] tracking-tight">
          {era.mostActiveMonthLabel}
        </p>
        {months.length > 1 && (
          <div className="mt-[7cqw] flex h-[22cqw] items-end gap-[1.2cqw]" aria-hidden>
            {months.map((m) => (
              <span
                key={m.month}
                className="flex-1 rounded-t-[1cqw] bg-white"
                style={{
                  height: `${Math.max(6, (m.count / max) * 100)}%`,
                  opacity: m.month === era.mostActiveMonth ? 1 : 0.45,
                }}
              />
            ))}
          </div>
        )}
      </Canvas>
    ),
  };
}

function topAdThemes(themed: Record<string, string[]> | undefined): string[] {
  if (!themed) return [];
  return Object.entries(themed)
    .filter(([theme, list]) => theme !== "Other" && list.length > 0)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([theme]) => theme);
}
