"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Copy, Check, Download } from "lucide-react";
import { toPng } from "html-to-image";
import type { ShareCardData } from "@/types/insights";
import { renderShareCardLines } from "@/lib/shareCard";

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall back to the legacy copy path below
  }
  const active = document.activeElement as HTMLElement | null;
  const el = document.createElement("textarea");
  try {
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    el.remove();
    active?.focus();
  }
}

interface ShareWrappedCardProps {
  card: ShareCardData;
  hideNames: boolean;
  variant?: "hero" | "compact";
  personalityTitle?: string;
}

export function ShareWrappedCard({
  card,
  hideNames,
  variant = "compact",
  personalityTitle,
}: ShareWrappedCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const lines = renderShareCardLines(card, hideNames);
  const isHero = variant === "hero" || card.id === "overall";

  const flash = (update: () => void, reset: () => void, ms: number) => {
    update();
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(reset, ms);
  };

  const copyStats = async () => {
    const ok = await copyText(lines.join("\n"));
    if (ok) {
      flash(
        () => {
          setNotice(null);
          setCopied(true);
        },
        () => setCopied(false),
        2000
      );
    } else {
      flash(
        () => setNotice("Couldn't copy — your browser blocked clipboard access."),
        () => setNotice(null),
        4000
      );
    }
  };

  const downloadPng = async () => {
    if (!ref.current) return;
    setDownloading(true);
    setNotice(null);
    try {
      const dataUrl = await toPng(ref.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: "#050509",
      });
      const link = document.createElement("a");
      link.download = `ig-wrapped-${card.id}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Share card PNG export failed", err);
      flash(
        () =>
          setNotice("Couldn't create the PNG. Try again, or take a screenshot."),
        () => setNotice(null),
        5000
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        ref={ref}
        className={`relative overflow-hidden rounded-3xl animated-gradient-border bg-[#0a0a12]/90 ${
          isHero ? "min-h-[320px]" : ""
        }`}
      >
        <div
          className={`animated-gradient-bg ${isHero ? "h-2" : "h-1.5"}`}
          aria-hidden
        />
        <div className={isHero ? "p-8" : "p-6"}>
        <div className="relative">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#DD2A7B]" />
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">
              IG Wrapped
            </p>
          </div>
          <h3
            className={`mt-3 font-bold text-white ${
              isHero ? "text-3xl sm:text-4xl" : "text-xl"
            }`}
          >
            {card.title}
          </h3>
          {personalityTitle && isHero && (
            <span className="mt-3 inline-block rounded-full border border-[#DD2A7B]/40 bg-[#DD2A7B]/15 px-4 py-1.5 text-sm font-semibold text-[#f9a8d4]">
              {personalityTitle}
            </span>
          )}

          <ul
            className={`mt-6 space-y-2 ${
              isHero ? "grid gap-3 sm:grid-cols-2" : ""
            }`}
          >
            {lines.map((line) => {
              const [label, ...rest] = line.split(":");
              const value = rest.join(":").trim();
              return (
                <li
                  key={line}
                  className={
                    isHero
                      ? "rounded-xl border border-white/10 bg-black/20 px-4 py-3 backdrop-blur-sm"
                      : "text-sm text-white/80"
                  }
                >
                  {isHero ? (
                    <>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                        {label}
                      </p>
                      <p className="mt-0.5 text-lg font-bold text-white">
                        {value || label}
                      </p>
                    </>
                  ) : (
                    line
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={copyStats}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          Copy stats
        </button>
        <button
          type="button"
          onClick={downloadPng}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 rounded-lg animated-gradient-bg px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" />
          {downloading ? "Saving…" : "Download PNG"}
        </button>
      </div>
      {notice && (
        <p role="alert" className="text-xs text-amber-300/90">
          {notice}
        </p>
      )}
    </div>
  );
}
