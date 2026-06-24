"use client";

import { HardDrive, Cloud } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function AccountStatusCard() {
  const { user, isConfigured } = useAuth();

  if (!isConfigured) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5">
            <HardDrive className="h-4 w-4 text-white/40" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Local Mode</p>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              Cloud save is not configured yet. The app runs fully in local
              mode. See <code>SUPABASE_SETUP.md</code> to enable optional
              accounts.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#F58529]/20 to-[#515BD4]/20">
            <HardDrive className="h-4 w-4 text-[#DD2A7B]" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">Local Mode</p>
            <p className="mt-1 text-xs leading-relaxed text-white/45">
              Analyze your export without an account. Sign in only if you want
              to save your full analysis and progress across devices.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#515BD4]/20 bg-[#515BD4]/10 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#515BD4]/20">
          <Cloud className="h-4 w-4 text-[#818cf8]" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Account Save Enabled</p>
          <p className="mt-1 text-xs leading-relaxed text-white/50">
            Your ZIP is parsed locally. When you save, IG Wrapped stores your
            parsed analysis snapshot and progress to your account.
          </p>
        </div>
      </div>
    </div>
  );
}
