"use client";

import type { ReactNode } from "react";
import { Lock, MonitorSmartphone, UserX } from "lucide-react";
import { Wordmark, NOT_AFFILIATED } from "@/components/ig/Logo";
import { BrandAvatar } from "@/components/ig/Avatar";
import { CANVAS_TONES, type CanvasTone } from "@/components/feed/Canvas";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { useAuth } from "@/contexts/AuthContext";

interface LandingViewProps {
  onFileSelect: (file: File) => void;
  onTryDemo: () => void;
  onShowGuide: () => void;
  onSignIn: () => void;
  onOpenSaved: () => void;
  isLoading: boolean;
  loadingText: string;
  loadingProgress: number;
  onCancel: () => void;
  error: string | null;
}

/** The signed-out front door, laid out like instagram.com's login page. */
export function LandingView({
  onFileSelect,
  onTryDemo,
  onShowGuide,
  onSignIn,
  onOpenSaved,
  isLoading,
  loadingText,
  loadingProgress,
  onCancel,
  error,
}: LandingViewProps) {
  const { user, isConfigured } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-ig-bg">
      <main className="flex flex-1 items-center justify-center gap-8 px-4 py-10">
        <PhonePreview />

        <div className="w-full max-w-[350px] space-y-2.5">
          <section className="border border-ig-border px-10 pb-8 pt-10 text-center sm:rounded-[1px]">
            <h1 className="mb-3">
              <Wordmark className="text-[52px]" />
              <span className="sr-only"> — your Instagram data, decoded</span>
            </h1>
            <p className="mb-7 text-[17px] font-semibold leading-5 text-ig-muted">
              See what Instagram knows about you — followers, DMs, ads and more.
            </p>
            <UploadDropzone
              variant="card"
              onFileSelect={onFileSelect}
              onTryDemo={onTryDemo}
              onShowGuide={onShowGuide}
              isLoading={isLoading}
              loadingText={loadingText}
              loadingProgress={loadingProgress}
              onCancel={onCancel}
              error={error}
            />
          </section>

          {isConfigured && (
            <section className="border border-ig-border py-5 text-center text-sm sm:rounded-[1px]">
              {user ? (
                <>
                  Welcome back.{" "}
                  <button type="button" onClick={onOpenSaved} className="font-semibold text-ig-blue hover:text-ig-link">
                    Open a saved analysis
                  </button>
                </>
              ) : (
                <>
                  Saved an analysis before?{" "}
                  <button type="button" onClick={onSignIn} className="font-semibold text-ig-blue hover:text-ig-link">
                    Log in
                  </button>
                </>
              )}
            </section>
          )}

          <div className="pt-3 text-center">
            <p className="text-sm">Private by design.</p>
            <ul className="mt-4 grid grid-cols-3 gap-2 text-[11px] leading-tight text-ig-muted">
              <Promise icon={UserX}>No Instagram login</Promise>
              <Promise icon={MonitorSmartphone}>Parsed in your browser</Promise>
              <Promise icon={Lock}>ZIP never uploaded</Promise>
            </ul>
          </div>
        </div>
      </main>

      <footer className="px-4 pb-10 pt-4 text-center text-xs text-ig-muted">
        <p className="leading-6">
          {["Privacy-first", "No scraping", "No LinkedIn automation", "Optional cloud save"].join("  ·  ")}
        </p>
        <p className="mt-3">© {new Date().getFullYear()} IG Wrapped · {NOT_AFFILIATED}</p>
      </footer>
    </div>
  );
}

function Promise({ icon: Icon, children }: { icon: typeof Lock; children: ReactNode }) {
  return (
    <li className="flex flex-col items-center gap-1.5">
      <Icon className="h-5 w-5 text-fg" strokeWidth={1.6} />
      {children}
    </li>
  );
}

const SCREENS: { tone: CanvasTone; label: string; body: ReactNode }[] = [
  {
    tone: "gradient",
    label: "Wrapped",
    body: (
      <>
        <p className="text-[8.5cqw] font-bold leading-none">Your Instagram,</p>
        <p className="font-logo text-[27cqw] leading-[0.9]">Wrapped</p>
        <p className="mt-[5cqw] text-[4.6cqw] opacity-90">Your followers, DMs and ads — as stories.</p>
      </>
    ),
  },
  {
    tone: "pink",
    label: "Not following back",
    body: (
      <>
        <p className="text-[30cqw] font-bold leading-[0.85] tracking-[-0.05em]">38</p>
        <p className="mt-[4cqw] text-[6.4cqw] font-semibold leading-tight">
          accounts you follow don&apos;t follow you back
        </p>
      </>
    ),
  },
  {
    tone: "yellow",
    label: "Ads",
    body: (
      <>
        <p className="text-[6cqw] font-semibold">Instagram thinks…</p>
        <p className="mt-[3cqw] text-[10cqw] font-bold leading-[1.02] tracking-tight">
          “You&apos;re into shopping, fitness and 3 a.m. recipes.”
        </p>
      </>
    ),
  },
];

/** A phone showing sample stories, like the screenshots on Instagram's login page. */
function PhonePreview() {
  return (
    <div className="hidden shrink-0 lg:block" aria-hidden>
      <div className="h-[600px] w-[296px] rounded-[48px] bg-[#111] p-[10px] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)] ring-1 ring-black/10">
        <div className="@container relative h-full w-full overflow-hidden rounded-[38px] bg-black">
          {SCREENS.map((screen, i) => (
            <div key={i} className="phone-screen absolute inset-0" style={CANVAS_TONES[screen.tone]}>
              <div className="absolute inset-x-0 top-0 flex gap-[1cqw] px-[3cqw] pt-[9cqw]">
                {SCREENS.map((_, j) => (
                  <span key={j} className={`h-[0.8cqw] flex-1 rounded-full bg-current ${j <= i ? "" : "opacity-35"}`} />
                ))}
              </div>
              <div className="absolute inset-x-0 top-[13cqw] flex items-center gap-[2.5cqw] px-[4cqw]">
                <BrandAvatar size={26} />
                <span className="text-[4.2cqw] font-semibold">ig.wrapped</span>
                <span className="text-[4cqw] opacity-75">{screen.label}</span>
              </div>
              <div className="absolute inset-0 flex flex-col justify-center px-[9cqw]">{screen.body}</div>
              <div className="absolute inset-x-[4cqw] bottom-[6cqw] rounded-full border border-current px-[5cqw] py-[3cqw] text-[4.2cqw] opacity-80">
                Tap to continue
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
