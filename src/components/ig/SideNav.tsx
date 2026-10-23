"use client";

import { useEffect, useRef, useState, type ElementType } from "react";
import {
  Bookmark,
  ChevronRight,
  Clapperboard,
  Compass,
  EyeOff,
  Heart,
  House,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Search,
  SquarePlus,
  Sun,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  PROFILE_TABS,
  TOOL_TABS,
  type DashboardTabId,
} from "@/components/DashboardTabs";
import { Avatar } from "@/components/ig/Avatar";
import { LogoMark, Wordmark } from "@/components/ig/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { usePresentationMode } from "@/contexts/PresentationContext";
import { useTheme } from "@/lib/useTheme";

interface SideNavProps {
  active: DashboardTabId;
  onNavigate: (tab: DashboardTabId) => void;
  onCreate: () => void;
  onOpenStory: () => void;
  onSignIn: () => void;
  onClearSession: () => void;
}

type NavItem =
  | { kind: "tab"; id: DashboardTabId; label: string; icon: ElementType; fillWhenActive?: boolean }
  | { kind: "action"; id: "story" | "create"; label: string; icon: ElementType };

const NAV_ITEMS: NavItem[] = [
  { kind: "tab", id: "home", label: "Home", icon: House, fillWhenActive: true },
  { kind: "tab", id: "search", label: "Search", icon: Search },
  { kind: "tab", id: "explore", label: "Explore", icon: Compass },
  { kind: "action", id: "story", label: "Wrapped", icon: Clapperboard },
  { kind: "tab", id: "messages", label: "Messages", icon: MessageCircle, fillWhenActive: true },
  { kind: "tab", id: "activity", label: "Notifications", icon: Heart, fillWhenActive: true },
  { kind: "action", id: "create", label: "Create", icon: SquarePlus },
];

function isActive(item: NavItem, active: DashboardTabId) {
  return item.kind === "tab" && item.id === active;
}

/**
 * Instagram's navigation: a labeled sidebar on wide screens, an icon rail
 * on tablets, and a top bar plus bottom tab bar on phones.
 */
export function SideNav({
  active,
  onNavigate,
  onCreate,
  onOpenStory,
  onSignIn,
  onClearSession,
}: SideNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const profileActive = PROFILE_TABS.has(active);

  const run = (item: NavItem) => {
    if (item.kind === "tab") onNavigate(item.id);
    else if (item.id === "story") onOpenStory();
    else onCreate();
  };

  const menu = menuOpen && (
    <MoreMenu
      onClose={() => setMenuOpen(false)}
      onNavigate={onNavigate}
      onSignIn={onSignIn}
      onClearSession={onClearSession}
    />
  );

  return (
    <>
      {/* Tablet and desktop sidebar */}
      <nav
        aria-label="Main"
        className="fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col border-r border-ig-border bg-ig-bg px-3 pb-5 pt-2 md:flex xl:w-[244px]"
      >
        <button
          type="button"
          onClick={() => onNavigate("home")}
          className="mb-4 flex h-[73px] items-center px-3 pt-4"
          aria-label="IG Wrapped home"
        >
          <span className="xl:hidden">
            <LogoMark size={26} />
          </span>
          <Wordmark className="hidden text-[30px] xl:inline" />
        </button>

        <ul className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.id}>
              <NavButton
                label={item.label}
                icon={item.icon}
                active={isActive(item, active)}
                fill={item.kind === "tab" && item.fillWhenActive}
                onClick={() => run(item)}
              />
            </li>
          ))}
          <li>
            <NavButton
              label="Profile"
              active={profileActive}
              onClick={() => onNavigate("profile")}
              avatar
            />
          </li>
        </ul>

        <div>
          <NavButton
            label="More"
            icon={Menu}
            active={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            expanded={menuOpen}
          />
        </div>
      </nav>

      {/* Phone top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-[60px] items-center justify-between border-b border-ig-border bg-ig-bg px-4 md:hidden">
        <button type="button" onClick={() => onNavigate("home")} aria-label="IG Wrapped home">
          <Wordmark className="text-[28px]" />
        </button>
        <div className="flex items-center gap-1">
          <IconButton
            label="Notifications"
            icon={Heart}
            active={active === "activity"}
            onClick={() => onNavigate("activity")}
          />
          <IconButton
            label="Messages"
            icon={MessageCircle}
            active={active === "messages"}
            onClick={() => onNavigate("messages")}
          />
          <IconButton
            label="More"
            icon={Menu}
            active={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            expanded={menuOpen}
          />
        </div>
      </header>

      {/* One menu instance: under the top bar on phones, above "More" on wider screens. */}
      {menuOpen && (
        <div className="fixed right-2 top-[58px] z-50 md:bottom-[76px] md:left-3 md:right-auto md:top-auto">
          {menu}
        </div>
      )}

      {/* Phone bottom tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 flex h-[50px] items-center justify-around border-t border-ig-border bg-ig-bg md:hidden"
      >
        <IconButton label="Home" icon={House} active={active === "home"} fill onClick={() => onNavigate("home")} />
        <IconButton label="Explore" icon={Compass} active={active === "explore" || active === "search"} onClick={() => onNavigate("explore")} />
        <IconButton label="Create" icon={SquarePlus} onClick={onCreate} />
        <IconButton label="Wrapped" icon={Clapperboard} onClick={onOpenStory} />
        <button
          type="button"
          aria-label="Profile"
          aria-current={profileActive ? "page" : undefined}
          onClick={() => onNavigate("profile")}
          className="p-2"
        >
          <span className={`block rounded-full ${profileActive ? "ring-2 ring-fg ring-offset-1 ring-offset-ig-bg" : ""}`}>
            <Avatar size={24} />
          </span>
        </button>
      </nav>
    </>
  );
}

function NavButton({
  label,
  icon: Icon,
  active,
  fill,
  avatar,
  expanded,
  onClick,
}: {
  label: string;
  icon?: ElementType;
  active?: boolean;
  fill?: boolean;
  avatar?: boolean;
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active && expanded === undefined ? "page" : undefined}
      aria-expanded={expanded}
      title={label}
      className="group flex w-full items-center gap-4 rounded-lg p-3 text-[16px] leading-5 text-fg transition-colors hover:bg-ig-hover"
    >
      <span className="transition-transform group-hover:scale-105 group-active:scale-95">
        {avatar ? (
          <span className={`block rounded-full ${active ? "ring-2 ring-fg ring-offset-1 ring-offset-ig-bg" : ""}`}>
            <Avatar size={24} />
          </span>
        ) : Icon ? (
          <Icon
            className={`h-6 w-6 ${active && fill ? "fill-current" : ""}`}
            strokeWidth={active ? 2.6 : 1.9}
          />
        ) : null}
      </span>
      <span className={`hidden xl:inline ${active ? "font-bold" : ""}`}>{label}</span>
    </button>
  );
}

function IconButton({
  label,
  icon: Icon,
  active,
  fill,
  expanded,
  onClick,
}: {
  label: string;
  icon: ElementType;
  active?: boolean;
  fill?: boolean;
  expanded?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active && expanded === undefined ? "page" : undefined}
      aria-expanded={expanded}
      onClick={onClick}
      className="rounded-full p-2 text-fg"
    >
      <Icon
        className={`h-6 w-6 ${active && fill ? "fill-current" : ""}`}
        strokeWidth={active ? 2.6 : 1.9}
      />
    </button>
  );
}

/** The "More" menu: appearance, presentation mode, tools and account. */
function MoreMenu({
  onClose,
  onNavigate,
  onSignIn,
  onClearSession,
}: {
  onClose: () => void;
  onNavigate: (tab: DashboardTabId) => void;
  onSignIn: () => void;
  onClearSession: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [showTools, setShowTools] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { presentationMode, togglePresentationMode } = usePresentationMode();
  const { user, isConfigured, signOut } = useAuth();

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const el = ref.current;
      // The toggle buttons manage their own open state.
      const toggle = (e.target as HTMLElement | null)?.closest("[aria-expanded]");
      if (el && !el.contains(e.target as Node) && !toggle) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const go = (tab: DashboardTabId) => {
    onNavigate(tab);
    onClose();
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="More"
      className="ig-fade-up w-[266px] overflow-hidden rounded-2xl bg-ig-elevated p-2 text-fg shadow-[0_4px_12px_rgba(0,0,0,0.15)] ring-1 ring-black/5"
    >
      {showTools ? (
        <>
          <MenuRow icon={ChevronRight} label="Back" flip onClick={() => setShowTools(false)} />
          <div className="my-1.5 h-px bg-ig-border" />
          {TOOL_TABS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              role="menuitem"
              onClick={() => go(tool.id)}
              className="block w-full rounded-lg px-4 py-2.5 text-left hover:bg-ig-hover"
            >
              <span className="block text-sm">{tool.label}</span>
              <span className="block text-xs text-ig-muted">{tool.description}</span>
            </button>
          ))}
        </>
      ) : (
        <>
          <MenuRow
            icon={theme === "dark" ? Sun : Moon}
            label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
          />
          <MenuRow
            icon={EyeOff}
            label={presentationMode ? "Turn off presentation mode" : "Presentation mode"}
            hint={presentationMode ? "Names are hidden" : "Hide names before sharing your screen"}
            onClick={() => {
              togglePresentationMode();
              onClose();
            }}
          />
          <MenuRow icon={Bookmark} label="Saved" onClick={() => go("saved")} />
          <MenuRow icon={Wrench} label="Tools" trailing onClick={() => setShowTools(true)} />
          <div className="my-1.5 h-1.5 -mx-2 bg-ig-secondary/60" />
          {isConfigured &&
            (user ? (
              <>
                <p className="truncate px-4 pb-1 pt-2 text-xs text-ig-muted">{user.email}</p>
                <MenuRow
                  icon={LogOut}
                  label="Log out"
                  onClick={() => {
                    void signOut();
                    onClose();
                  }}
                />
              </>
            ) : (
              <MenuRow
                icon={LogIn}
                label="Log in to save"
                onClick={() => {
                  onSignIn();
                  onClose();
                }}
              />
            ))}
          <MenuRow
            icon={Trash2}
            label="Clear this analysis"
            onClick={() => {
              onClose();
              onClearSession();
            }}
          />
        </>
      )}
    </div>
  );
}

function MenuRow({
  icon: Icon,
  label,
  hint,
  trailing,
  flip,
  onClick,
}: {
  icon: ElementType;
  label: string;
  hint?: string;
  trailing?: boolean;
  flip?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm hover:bg-ig-hover"
    >
      <Icon className={`h-[18px] w-[18px] shrink-0 ${flip ? "rotate-180" : ""}`} />
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {hint && <span className="block text-xs text-ig-muted">{hint}</span>}
      </span>
      {trailing && <ChevronRight className="h-4 w-4 shrink-0 text-ig-muted" />}
    </button>
  );
}
