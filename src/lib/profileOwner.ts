import type { InsightsBundle } from "@/types/insights";

export interface ProfileOwner {
  /** Instagram handle, or a neutral placeholder when it is hidden or unknown. */
  handle: string;
  /** Display name from the export, when known and not hidden. */
  name: string | null;
}

const PLACEHOLDER_HANDLE = "your.profile";

/**
 * The export owner as shown on the profile and feed. Names come from the
 * owner identity the insights engine resolved; while presenting, or when
 * the export never says who it belongs to, a neutral handle is used.
 */
export function resolveProfileOwner(
  insights: InsightsBundle | null | undefined,
  showNames: boolean
): ProfileOwner {
  if (!showNames) return { handle: PLACEHOLDER_HANDLE, name: null };
  const validation = insights?.dataExplorer?.coreAnalytics?.validation;
  const handle = validation?.ownerIdentityUsernames?.find((u) => u.trim());
  const name = validation?.ownerIdentityDisplayNames?.find((n) => n.trim()) ?? null;
  return { handle: handle ?? PLACEHOLDER_HANDLE, name };
}

/** "1 group chat" / "3 group chats". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count.toLocaleString()} ${count === 1 ? singular : pluralForm}`;
}
