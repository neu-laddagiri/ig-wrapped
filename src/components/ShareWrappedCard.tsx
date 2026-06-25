"use client";

import { useRef, useState } from "react";
import { Sparkles, Copy, Check, Download } from "lucide-react";
import { toPng } from "html-to-image";
import type { ShareCardData } from "@/types/insights";
import { renderShareCardLines } from "@/lib/shareCard";

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

  const lines = renderShareCardLines(card, hideNames);
  const isHero = variant === "hero" || card.id === "overall";

  const copyStats = async () => {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const downloadPng = async () => {
    if (!ref.current) return;
    setDownloading(true);
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
    } catch {
      // ignore
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div
        ref={ref}
        className={`relative overflow-hidden rounded-3xl animated-gradient-border bg-[#0a0a12]/90 ${
          isHero
            ? "min-h-[320px] p-8"
            : "p-6"
        }`}
      >
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
    </div>
  );
}
