import { formatTimestamp } from "@/lib/formatters";
import type {
  FlaggedSecurityEvent,
  SecurityData,
  SecurityEvent,
  SecurityEventType,
  SuspiciousLoginAnalysis,
} from "@/types/instagram";

const BURST_WINDOW_MS = 30 * 60 * 1000;
const BURST_THRESHOLD = 4;
const NEAR_CHANGE_MS = 24 * 60 * 60 * 1000;

function isLoginType(type: SecurityEventType): boolean {
  return type === "login";
}

function locationKey(event: SecurityEvent): string | null {
  const loc = event.location?.trim().toLowerCase();
  if (!loc || loc === "unknown" || loc === "—") return null;
  return loc;
}

function deviceKey(event: SecurityEvent): string | null {
  const dev = event.device?.trim().toLowerCase();
  if (!dev || dev === "unknown" || dev === "—") return null;
  return dev;
}

function buildFlag(
  event: SecurityEvent,
  reason: string,
  severity: FlaggedSecurityEvent["severity"]
): FlaggedSecurityEvent {
  return { event, reason, severity };
}

export function analyzeSuspiciousLogins(
  security: SecurityData
): SuspiciousLoginAnalysis {
  const events = security.events ?? [];
  const logins = events.filter((e) => isLoginType(e.type) && e.timestamp);
  const passwordChanges = events.filter((e) => e.type === "password_change");
  const privacyChanges = events.filter((e) => e.type === "privacy_change");

  const flagged: FlaggedSecurityEvent[] = [];
  const flaggedIds = new Set<string>();

  const addFlag = (flag: FlaggedSecurityEvent) => {
    if (flaggedIds.has(flag.event.id)) return;
    flaggedIds.add(flag.event.id);
    flagged.push(flag);
  };

  const locationCounts = new Map<string, number>();
  const deviceCounts = new Map<string, number>();

  for (const login of logins) {
    const loc = locationKey(login);
    const dev = deviceKey(login);
    if (loc) locationCounts.set(loc, (locationCounts.get(loc) ?? 0) + 1);
    if (dev) deviceCounts.set(dev, (deviceCounts.get(dev) ?? 0) + 1);
  }

  const commonLocations = [...locationCounts.entries()]
    .filter(([, c]) => c >= 2)
    .map(([k]) => k);

  for (const login of logins) {
    const loc = locationKey(login);
    const dev = deviceKey(login);

    if (!loc && !dev) {
      addFlag(
        buildFlag(
          login,
          "Login with limited device or location details — worth reviewing.",
          "medium"
        )
      );
    } else {
      if (!loc) {
        addFlag(
          buildFlag(
            login,
            "Login missing location info — could be normal if this was you.",
            "medium"
          )
        );
      }
      if (!dev) {
        addFlag(
          buildFlag(
            login,
            "Login missing device/browser info — worth a quick check.",
            "medium"
          )
        );
      }
    }

    if (loc && locationCounts.get(loc) === 1) {
      addFlag(
        buildFlag(
          login,
          "Potentially unusual login location — only seen once in your export.",
          "medium"
        )
      );
    }

    if (dev && deviceCounts.get(dev) === 1) {
      addFlag(
        buildFlag(
          login,
          "Potentially unusual device or browser — only seen once in your export.",
          "medium"
        )
      );
    }

    if (
      loc &&
      commonLocations.length > 0 &&
      !commonLocations.includes(loc)
    ) {
      addFlag(
        buildFlag(
          login,
          "Login location differs from your most common areas — could be normal if you were traveling.",
          "medium"
        )
      );
    }
  }

  for (const login of logins) {
    if (!login.timestamp) continue;
    const nearbyPassword = passwordChanges.some(
      (e) =>
        e.timestamp &&
        Math.abs(e.timestamp - login.timestamp!) <= NEAR_CHANGE_MS
    );
    const nearbyPrivacy = privacyChanges.some(
      (e) =>
        e.timestamp &&
        Math.abs(e.timestamp - login.timestamp!) <= NEAR_CHANGE_MS
    );
    if (nearbyPassword) {
      addFlag(
        buildFlag(
          login,
          "Login occurred near a password change — worth reviewing if you did not make that change.",
          "high"
        )
      );
    } else if (nearbyPrivacy) {
      addFlag(
        buildFlag(
          login,
          "Login occurred near a privacy setting change — could be normal if this was you.",
          "medium"
        )
      );
    }
  }

  const sortedLogins = [...logins].sort(
    (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
  );
  for (let i = 0; i < sortedLogins.length; i++) {
    const base = sortedLogins[i].timestamp!;
    let burst = 1;
    for (let j = i + 1; j < sortedLogins.length; j++) {
      const ts = sortedLogins[j].timestamp!;
      if (ts - base <= BURST_WINDOW_MS) burst++;
      else break;
    }
    if (burst >= BURST_THRESHOLD) {
      addFlag(
        buildFlag(
          sortedLogins[i],
          `Multiple login events within a short window (${burst} in ~30 minutes) — could be normal app refreshes.`,
          "medium"
        )
      );
    }
  }

  for (const change of passwordChanges) {
    addFlag(
      buildFlag(
        change,
        "Password change recorded — worth reviewing if you did not initiate this.",
        "medium"
      )
    );
  }

  for (const change of privacyChanges) {
    addFlag(
      buildFlag(
        change,
        "Privacy setting change recorded — worth reviewing if unexpected.",
        "low"
      )
    );
  }

  const reviewedCount = events.length;
  const worthReviewingCount = flagged.length;

  let score = 92;
  for (const flag of flagged) {
    if (flag.severity === "high") score -= 8;
    else if (flag.severity === "medium") score -= 4;
    else score -= 1;
  }
  score = Math.max(45, Math.min(100, score));

  flagged.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    const diff =
      severityOrder[a.severity] - severityOrder[b.severity];
    if (diff !== 0) return diff;
    return (b.event.timestamp ?? 0) - (a.event.timestamp ?? 0);
  });

  return {
    securityScore: score,
    eventsReviewed: reviewedCount,
    worthReviewingCount,
    flaggedEvents: flagged,
    suggestions: [
      "Review unfamiliar devices in your login history.",
      "Change your password if something looks wrong.",
      "Enable two-factor authentication in Instagram settings.",
      "Check Instagram Account Center → Password and security.",
    ],
  };
}

export function resolveSuspiciousLoginAnalysis(
  security: SecurityData | null
): SuspiciousLoginAnalysis | null {
  if (!security) return null;
  if (security.suspiciousLoginAnalysis) return security.suspiciousLoginAnalysis;
  if (!security.events?.length) return null;
  return analyzeSuspiciousLogins(security);
}

export function formatSecurityEventTime(event: SecurityEvent): string {
  if (event.dateLabel) return event.dateLabel;
  if (event.timestamp) return formatTimestamp(event.timestamp);
  return "Date unknown";
}
