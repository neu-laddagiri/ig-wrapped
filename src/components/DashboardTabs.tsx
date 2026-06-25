"use client";

import { useMemo, useState } from "react";
import type { ElementType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Sparkles,
  MessageCircle,
  ShieldAlert,
  Lock,
  Briefcase,
  Download,
  Cloud,
  BarChart3,
  Network,
  Calendar,
  Brain,
  Database,
  Search,
  UsersRound,
  Trash2,
  Heart,
  ChevronDown,
  Menu,
  ListChecks,
  GitCompare,
  Bot,
} from "lucide-react";

export type DashboardTabId =
  | "overview"
  | "network"
  | "social"
  | "cleanup"
  | "realones"
  | "wrapped"
  | "funstats"
  | "eras"
  | "personality"
  | "dms"
  | "groups"
  | "ads"
  | "security"
  | "search"
  | "linkedin"
  | "explorer"
  | "export"
  | "saved"
  | "compare"
  | "actionplan";

type NavGroupId = "dashboard" | "people" | "messages" | "privacy" | "data";

interface TabDef {
  id: DashboardTabId;
  label: string;
  icon: ElementType;
}

interface NavGroup {
  id: NavGroupId;
  label: string;
  tabs: TabDef[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    tabs: [
      { id: "overview", label: "Overview", icon: LayoutDashboard },
      { id: "actionplan", label: "Action Plan", icon: ListChecks },
      { id: "wrapped", label: "Wrapped", icon: Sparkles },
      { id: "funstats", label: "Fun Stats", icon: BarChart3 },
      { id: "eras", label: "Eras", icon: Calendar },
      { id: "personality", label: "Personality", icon: Brain },
    ],
  },
  {
    id: "people",
    label: "People",
    tabs: [
      { id: "network", label: "Network", icon: Users },
      { id: "social", label: "Leaderboards", icon: Network },
      { id: "cleanup", label: "Cleanup", icon: Trash2 },
      { id: "realones", label: "Real Ones", icon: Heart },
      { id: "linkedin", label: "LinkedIn", icon: Briefcase },
    ],
  },
  {
    id: "messages",
    label: "Messages",
    tabs: [
      { id: "dms", label: "DMs", icon: MessageCircle },
      { id: "groups", label: "Groups", icon: UsersRound },
    ],
  },
  {
    id: "privacy",
    label: "Privacy",
    tabs: [
      { id: "ads", label: "Ads & Privacy", icon: ShieldAlert },
      { id: "security", label: "Security", icon: Lock },
      { id: "search", label: "Search", icon: Search },
    ],
  },
  {
    id: "data",
    label: "Data",
    tabs: [
      { id: "explorer", label: "Explorer", icon: Database },
      { id: "compare", label: "Compare", icon: GitCompare },
      { id: "export", label: "Export", icon: Download },
      { id: "saved", label: "Saved", icon: Cloud },
    ],
  },
];

const ALL_TABS = NAV_GROUPS.flatMap((g) => g.tabs);

function groupForTab(tabId: DashboardTabId): NavGroupId {
  for (const group of NAV_GROUPS) {
    if (group.tabs.some((t) => t.id === tabId)) return group.id;
  }
  return "dashboard";
}

interface DashboardTabsProps {
  activeTab: DashboardTabId;
  onTabChange: (tab: DashboardTabId) => void;
}

export function DashboardTabs({ activeTab, onTabChange }: DashboardTabsProps) {
  const activeGroupId = groupForTab(activeTab);
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeGroup = useMemo(
    () => NAV_GROUPS.find((g) => g.id === activeGroupId) ?? NAV_GROUPS[0],
    [activeGroupId]
  );

  const activeTabDef =
    ALL_TABS.find((t) => t.id === activeTab) ?? ALL_TABS[0];

  return (
    <div className="space-y-3">
      {/* Mobile: section picker */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white"
        >
          <span className="flex items-center gap-2">
            <Menu className="h-4 w-4 text-white/50" />
            {activeGroup.label} · {activeTabDef.label}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-white/40 transition ${mobileOpen ? "rotate-180" : ""}`}
          />
        </button>
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a12]/95"
            >
              {NAV_GROUPS.map((group) => (
                <div key={group.id} className="border-b border-white/5 p-2 last:border-0">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    {group.label}
                  </p>
                  {group.tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          onTabChange(tab.id);
                          setMobileOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                          isActive
                            ? "animated-gradient-bg text-white"
                            : "text-white/55 hover:bg-white/5 hover:text-white/80"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop: group pills + sub-tabs */}
      <div className="hidden lg:block">
        <div className="flex flex-wrap gap-1.5">
          {NAV_GROUPS.map((group) => {
            const isGroupActive = group.id === activeGroupId;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => {
                  if (!isGroupActive) {
                    onTabChange(group.tabs[0].id);
                  }
                }}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  isGroupActive
                    ? "animated-gradient-bg text-white"
                    : "border border-white/10 bg-white/[0.03] text-white/45 hover:text-white/70"
                }`}
              >
                {group.label}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5">
          {activeGroup.tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                        className={`relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                          isActive ? "text-white" : "text-white/45 hover:text-white/70"
                        }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeSubTab"
                    className="absolute inset-0 rounded-xl border border-white/10 animated-gradient-bg opacity-20"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
                  />
                )}
                <Icon className="relative h-4 w-4 shrink-0" />
                <span className="relative">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { ALL_TABS as DASHBOARD_TABS };
