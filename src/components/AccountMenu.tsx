"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Cloud, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { DashboardTabId } from "@/components/DashboardTabs";

interface AccountMenuProps {
  onSignIn: () => void;
  onNavigateTab?: (tab: DashboardTabId) => void;
}

export function AccountMenu({ onSignIn, onNavigateTab }: AccountMenuProps) {
  const { user, loading, signOut, isConfigured } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (loading) {
    return (
      <div className="h-10 w-24 animate-pulse rounded-full bg-white/5" />
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:border-[#DD2A7B]/40 hover:bg-white/10"
      >
        Sign in
      </button>
    );
  }

  const label = user.email?.split("@")[0] ?? "Account";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:border-[#DD2A7B]/40 hover:bg-white/10"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#F58529]/30 to-[#515BD4]/30">
          <User className="h-3.5 w-3.5" />
        </span>
        <span className="max-w-[120px] truncate">{label}</span>
        <ChevronDown className={`h-4 w-4 text-white/40 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c12]/95 py-1 shadow-xl backdrop-blur-xl">
          <p className="border-b border-white/10 px-4 py-2 text-xs text-white/40 truncate">
            {user.email}
          </p>
          {isConfigured && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onNavigateTab?.("saved");
              }}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/5"
            >
              <Cloud className="h-4 w-4" />
              Saved Analyses
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await signOut();
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-white/80 transition hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
