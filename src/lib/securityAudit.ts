import type { SecurityData } from "@/types/instagram";
import type { ConnectedApp, SecurityAuditResult } from "@/types/insights";
import { resolveSuspiciousLoginAnalysis } from "@/lib/securityAnalysis";

const STALE_MS = 365 * 24 * 60 * 60 * 1000;

export function computeSecurityAudit(
  security: SecurityData | null,
  connectedApps: ConnectedApp[] = []
): SecurityAuditResult | null {
  if (!security && !connectedApps.length) return null;

  const now = Date.now();
  const staleApps = connectedApps.filter((app) => {
    const last = app.lastUsedAt ?? app.addedAt;
    return last ? now - last * 1000 > STALE_MS : true;
  });

  const suspicious = security
    ? resolveSuspiciousLoginAnalysis(security)
    : null;

  let healthScore = suspicious?.securityScore ?? 85;
  healthScore -= staleApps.length * 3;
  healthScore = Math.max(0, Math.min(100, healthScore));

  return {
    healthScore,
    connectedApps,
    staleApps,
    suggestions: [
      "Enable two-factor authentication in Instagram settings.",
      "Review unfamiliar logins in your account timeline.",
      "Disconnect apps you no longer use.",
      "Check privacy settings in Account Center.",
      "Change your password if something looks unfamiliar.",
    ],
    loginTimelineCount: security?.loginCount ?? 0,
    passwordChangeCount: security?.passwordChangeCount ?? 0,
    privacyChangeCount: security?.privacyChangeCount ?? 0,
  };
}
