import type { CSSProperties, ElementType, ReactNode } from "react";
import { Gift } from "lucide-react";

export type RingState = "unseen" | "seen" | "loading";

interface AvatarProps {
  size?: number;
  className?: string;
  /** Accessible name; omit for decorative avatars next to a visible name. */
  title?: string;
}

/**
 * Instagram's default profile picture. Exports carry no profile photos, and
 * the silhouette also keeps people unidentifiable while presenting.
 */
export function Avatar({ size = 32, className = "", title }: AvatarProps) {
  return (
    <span
      className={`inline-block shrink-0 overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <svg viewBox="0 0 40 40" width={size} height={size} focusable="false">
        <rect width="40" height="40" fill="var(--ig-avatar-bg)" />
        <circle cx="20" cy="15.2" r="7.2" fill="var(--ig-avatar-fg)" />
        <path
          d="M5.6 39c1.4-8.1 7.3-12.8 14.4-12.8S33 30.9 34.4 39Z"
          fill="var(--ig-avatar-fg)"
        />
      </svg>
    </span>
  );
}

/** The IG Wrapped account: author of every insight post. */
export function BrandAvatar({ size = 32, className = "" }: AvatarProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-ig-gradient text-white ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Gift
        style={{ width: size * 0.52, height: size * 0.52 }}
        strokeWidth={2.2}
      />
    </span>
  );
}

const ICON_TONES = {
  neutral: "bg-ig-secondary text-fg",
  brand: "bg-ig-gradient text-white",
} as const;

/** Round icon cover, like an Instagram story highlight. */
export function IconAvatar({
  icon: Icon,
  size = 56,
  tone = "neutral",
  className = "",
}: {
  icon: ElementType;
  size?: number;
  tone?: keyof typeof ICON_TONES;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${ICON_TONES[tone]} ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Icon style={{ width: size * 0.42, height: size * 0.42 }} strokeWidth={1.8} />
    </span>
  );
}

/** Gradient ring (gray once viewed, spinning while "loading") around an avatar. */
export function StoryRing({
  state = "unseen",
  children,
  pad = 4,
  className = "",
}: {
  state?: RingState;
  children: ReactNode;
  /** Ring thickness plus gap, in px. */
  pad?: number;
  className?: string;
}) {
  return (
    <span
      className={`story-ring ${className}`}
      data-state={state}
      style={{ padding: pad } as CSSProperties}
    >
      {children}
    </span>
  );
}
