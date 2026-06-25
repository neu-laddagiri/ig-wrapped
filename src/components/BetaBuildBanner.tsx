import { Info } from "lucide-react";

const BETA_MESSAGE =
  "IG Wrapped is still being actively improved. Some stats, rankings, account matches, and AI summaries may contain inconsistencies while bugs are being fixed.";

export function BetaBuildBanner() {
  return (
    <div
      className="beta-build-banner mx-auto mt-6 w-full max-w-3xl"
      role="status"
      aria-live="polite"
    >
      <div className="beta-build-banner-shell">
        <div className="beta-build-banner-inner">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="flex shrink-0 items-center gap-2">
              <span className="beta-build-badge">BETA BUILD</span>
              <span className="relative flex h-4 w-4 items-center justify-center">
                <span
                  className="beta-build-pulse-dot absolute"
                  aria-hidden="true"
                />
                <Info
                  className="relative h-3.5 w-3.5 text-[#DD2A7B]/90"
                  aria-hidden="true"
                />
              </span>
            </div>
            <p className="text-sm leading-relaxed text-white/72 sm:pt-0.5">
              {BETA_MESSAGE}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
