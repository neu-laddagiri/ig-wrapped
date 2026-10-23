import type { ReactNode } from "react";

/**
 * Post "photos". Like a picture, a canvas keeps its colors in light and
 * dark mode; the palette is Instagram's brand gradient stops. Sizes use
 * container units so text scales with the post width.
 */
export const CANVAS_TONES = {
  gradient: {
    background:
      "linear-gradient(135deg, #ffd600 0%, #ff7a00 24%, #ff0069 52%, #d300c5 76%, #7638fa 100%)",
    color: "#ffffff",
  },
  pink: { background: "#ff0069", color: "#ffffff" },
  purple: { background: "#7638fa", color: "#ffffff" },
  orange: { background: "#ff7a00", color: "#ffffff" },
  magenta: { background: "#d300c5", color: "#ffffff" },
  yellow: { background: "#ffd600", color: "#000000" },
  ink: { background: "#000000", color: "#ffffff" },
  paper: { background: "#f4f1ec", color: "#000000" },
} as const;

export type CanvasTone = keyof typeof CANVAS_TONES;

export function Canvas({
  tone,
  label,
  children,
  footer = "IG Wrapped · from your export",
}: {
  tone: CanvasTone;
  label: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      className="absolute inset-0 flex select-none flex-col overflow-hidden p-[7cqw]"
      style={CANVAS_TONES[tone]}
    >
      <p className="text-[3.1cqw] font-semibold uppercase leading-none tracking-[0.18em] opacity-80">
        {label}
      </p>
      <div className="flex min-h-0 flex-1 flex-col justify-center">{children}</div>
      <div className="text-[3cqw] leading-none opacity-75">{footer}</div>
    </div>
  );
}

/** The one big number a post is about. */
export function HeroNumber({
  value,
  caption,
  size = 26,
}: {
  value: string;
  caption?: string;
  size?: number;
}) {
  return (
    <div>
      <p
        className="font-bold leading-[0.9] tracking-[-0.04em] tabular-nums"
        style={{ fontSize: `${size}cqw` }}
      >
        {value}
      </p>
      {caption && (
        <p className="mt-[3cqw] max-w-[80%] text-[5.4cqw] font-semibold leading-[1.15]">
          {caption}
        </p>
      )}
    </div>
  );
}

export function CanvasNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-[4cqw] max-w-[85%] text-[3.9cqw] leading-snug opacity-85">
      {children}
    </p>
  );
}

/** White silhouette avatar used inside canvases. */
export function CanvasAvatar({ size }: { size: string }) {
  return (
    <span
      className="inline-block shrink-0 overflow-hidden rounded-full ring-[0.6cqw] ring-white/90"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 40 40" className="h-full w-full">
        <rect width="40" height="40" fill="rgba(255,255,255,0.28)" />
        <circle cx="20" cy="15.2" r="7.2" fill="rgba(255,255,255,0.92)" />
        <path
          d="M5.6 39c1.4-8.1 7.3-12.8 14.4-12.8S33 30.9 34.4 39Z"
          fill="rgba(255,255,255,0.92)"
        />
      </svg>
    </span>
  );
}
