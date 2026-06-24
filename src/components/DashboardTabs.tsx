"use client";

import type { ElementType } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";

export type DashboardTabId =
  | "overview"
  | "network"
  | "wrapped"
  | "funstats"
  | "dms"
  | "ads"
  | "security"
  | "linkedin"
  | "export"
  | "saved";

const tabs: {
  id: DashboardTabId;
  label: string;
  icon: ElementType;
}[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "network", label: "Network Manager", icon: Users },
  { id: "wrapped", label: "Wrapped Insights", icon: Sparkles },
  { id: "funstats", label: "Fun Stats", icon: BarChart3 },
  { id: "dms", label: "DMs", icon: MessageCircle },
  { id: "ads", label: "Ads & Privacy", icon: ShieldAlert },
  { id: "security", label: "Security", icon: Lock },
  { id: "linkedin", label: "LinkedIn Helper", icon: Briefcase },
  { id: "export", label: "Export Data", icon: Download },
  { id: "saved", label: "Saved Analyses", icon: Cloud },
];

interface DashboardTabsProps {
  activeTab: DashboardTabId;
  onTabChange: (tab: DashboardTabId) => void;
}

export function DashboardTabs({ activeTab, onTabChange }: DashboardTabsProps) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1.5 backdrop-blur-sm">
        {tabs.map((tab) => {
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
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#F58529]/20 via-[#DD2A7B]/20 to-[#515BD4]/20 border border-white/10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
              <Icon className="relative h-4 w-4" />
              <span className="relative hidden sm:inline">{tab.label}</span>
              <span className="relative sm:hidden">{tab.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
