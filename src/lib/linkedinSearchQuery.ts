import {
  formatAccountDisplayName,
  isValidAccountName,
  UNKNOWN_ACCOUNT_LABEL,
} from "@/lib/accountNameFilter";

export interface LinkedInSearchAccount {
  username?: string;
  /** Raw display name from DMs / network / receipt */
  displayName?: string;
  /** UI display label — preferred when it differs from username */
  displayLabel?: string;
}

export interface LinkedInSearchContext {
  /** e.g. "Northeastern University" when user/export context suggests a school */
  school?: string;
}

function cleanUsername(username?: string): string {
  return (username ?? "").trim().replace(/^@/, "").replace(/^dm:/, "");
}

function normalizeComparable(value: string): string {
  return value.toLowerCase().replace(/[\s._@-]/g, "");
}

function formatNameForSearch(name: string): string {
  const cleaned = formatAccountDisplayName(name);
  if (!cleaned || cleaned === UNKNOWN_ACCOUNT_LABEL) return name.trim();

  if (/\s/.test(cleaned) && /[A-Z]/.test(cleaned)) {
    return cleaned;
  }

  return cleaned
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      if (word === word.toUpperCase() && word.length <= 4) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/** True when the label looks like a real name, not just an IG handle. */
export function isFullDisplayName(display: string, username?: string): boolean {
  const cleaned = formatAccountDisplayName(display);
  if (!cleaned || cleaned === UNKNOWN_ACCOUNT_LABEL) return false;
  if (!isValidAccountName(cleaned)) return false;

  if (/\s+/.test(cleaned)) return true;

  const user = cleanUsername(username);
  if (!user) return false;

  const displayNorm = normalizeComparable(cleaned);
  const userNorm = normalizeComparable(user);
  if (displayNorm === userNorm) return false;

  return displayNorm.length >= 3 && !userNorm.includes(displayNorm);
}

function pickFullDisplayName(account: LinkedInSearchAccount): string | null {
  const username = cleanUsername(account.username);
  const candidates = [account.displayLabel, account.displayName].filter(
    (c): c is string => Boolean(c?.trim())
  );

  for (const candidate of candidates) {
    const cleaned = formatAccountDisplayName(candidate);
    if (cleaned === UNKNOWN_ACCOUNT_LABEL) continue;
    if (isFullDisplayName(cleaned, username)) {
      return formatNameForSearch(cleaned);
    }
  }

  return null;
}

function usernameToSpacedFallback(username: string): string | null {
  const clean = cleanUsername(username);
  if (!clean || !/[_\d.]/.test(clean)) return null;

  const spaced = clean
    .replace(/[._]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  if (!spaced.includes(" ")) return null;
  return formatNameForSearch(spaced);
}

export function inferLinkedInSchoolContext(
  searchTerms: string[] = []
): string | undefined {
  const fromEnv = process.env.NEXT_PUBLIC_LINKEDIN_SCHOOL_CONTEXT?.trim();
  if (fromEnv) return fromEnv;

  const hasSchoolSignal = searchTerms.some((term) =>
    /northeastern(\s+university)?/i.test(term)
  );
  if (hasSchoolSignal) return "Northeastern University";

  return undefined;
}

/** Build a Google query focused on linkedin.com/in profile pages. */
export function buildLinkedInSearchQuery(
  account: LinkedInSearchAccount,
  context?: LinkedInSearchContext
): string {
  const base = "site:linkedin.com/in";
  const username = cleanUsername(account.username);
  const fullName = pickFullDisplayName(account);
  const school = context?.school?.trim();

  if (fullName) {
    if (school) {
      return `${base} "${fullName}" "${school}"`;
    }
    return `${base} "${fullName}" LinkedIn`;
  }

  if (username && !/^\d{8,}$/.test(username)) {
    const spaced = usernameToSpacedFallback(username);
    if (spaced) {
      return `${base} "${spaced}" LinkedIn`;
    }
    return `${base} "${username}" LinkedIn`;
  }

  const fallback = fullName ?? username ?? "LinkedIn";
  return `${base} "${fallback}" LinkedIn`;
}

export function linkedInGoogleSearchUrl(
  account: LinkedInSearchAccount,
  context?: LinkedInSearchContext
): string {
  const query = buildLinkedInSearchQuery(account, context);
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function openLinkedInGoogleSearch(
  account: LinkedInSearchAccount,
  context?: LinkedInSearchContext
): void {
  window.open(
    linkedInGoogleSearchUrl(account, context),
    "_blank",
    "noopener,noreferrer"
  );
}
