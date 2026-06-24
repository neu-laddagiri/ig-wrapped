"use client";

import {
  LogIn,
  LogOut,
  User,
  Shield,
  Key,
  AlertTriangle,
  Clock,
} from "lucide-react";
import type { SecurityData } from "@/types/instagram";
import { SummaryCard } from "@/components/SummaryCard";
import { formatNumber } from "@/lib/formatters";

interface SecurityTabProps {
  security: SecurityData | null;
}

export function SecurityTab({ security }: SecurityTabProps) {
  if (!security) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
        <Shield className="mx-auto h-10 w-10 text-white/20" />
        <h3 className="mt-4 text-lg font-semibold text-white">
          No security data found
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
          Security files from{" "}
          <code className="text-white/60">security_and_login_information/</code>{" "}
          were not detected.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Logins" value={formatNumber(security.loginCount)} icon={LogIn} accent="green" />
        <SummaryCard label="Logouts" value={formatNumber(security.logoutCount)} icon={LogOut} accent="blue" />
        <SummaryCard label="Profile activity" value={formatNumber(security.profileActivityCount)} icon={User} accent="pink" />
        <SummaryCard label="Privacy changes" value={formatNumber(security.privacyChangeCount)} icon={Shield} accent="purple" />
        <SummaryCard label="Password changes" value={formatNumber(security.passwordChangeCount)} icon={Key} accent="orange" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#515BD4]" />
            <h3 className="font-semibold text-white">Account timeline</h3>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-white/45">
            A visual timeline of your account history will be available in a
            future update. For now, review login and profile activity counts
            above.
          </p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <h3 className="font-semibold text-amber-100">Security notes</h3>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-amber-200/80">
            <li>• Review login activity for unfamiliar devices or locations.</li>
            <li>• Check password change history for unauthorized updates.</li>
            <li>• Privacy setting changes may indicate account modifications.</li>
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-white/50" />
          <h3 className="font-semibold text-white">
            Suspicious login checker
          </h3>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/40">
            Coming soon
          </span>
        </div>
        <p className="mt-3 text-sm text-white/45">
          Future versions will flag logins from unusual locations, devices, or
          time patterns based on your export data.
        </p>
      </div>
    </div>
  );
}
