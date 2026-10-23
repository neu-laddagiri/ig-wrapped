"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { toPng } from "html-to-image";
import type { ShareCardData } from "@/types/insights";
import { renderShareCardLines } from "@/lib/shareCard";
import { CANVAS_TONES } from "@/components/feed/Canvas";

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
  personalityTitle?: string;
}

/** A 4:5 card in the Instagram gradient, made to be screenshotted or downloaded. */
export function ShareWrappedCard({
  card,
  hideNames,
  personalityTitle,
}: ShareWrappedCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const lines = renderShareCardLines(card, hideNames);

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
      const dataUrl = await toPng(ref.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `ig-wrapped-${card.id}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Share card PNG export failed", err);
      flash(
        () => setNotice("Couldn't create the PNG. Try again, or take a screenshot."),
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
        className="@container relative aspect-[4/5] w-full overflow-hidden rounded-xl"
        style={CANVAS_TONES.gradient}
      >
        <div className="absolute inset-0 flex flex-col p-[8cqw]">
          <div className="flex items-center justify-between">
            <span className="font-logo text-[10cqw] leading-none">IG Wrapped</span>
            <span className="text-[3.3cqw] font-semibold uppercase tracking-[0.16em] opacity-85">
              {new Date().getFullYear()}
            </span>
          </div>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[9cqw] font-bold leading-none tracking-tight">{card.title}</p>
            {personalityTitle && (
              <p className="mt-[2.5cqw] text-[5cqw] font-semibold opacity-90">{personalityTitle}</p>
            )}
            <ul className="mt-[7cqw] grid grid-cols-2 gap-x-[6cqw] gap-y-[5cqw]">
              {lines.slice(0, 8).map((line) => {
                const [label, ...rest] = line.split(":");
                const value = rest.join(":").trim();
                return (
                  <li key={line} className="min-w-0">
                    <p className="truncate text-[7.5cqw] font-bold leading-none tabular-nums">
                      {value || label}
                    </p>
                    {value && <p className="mt-[1.2cqw] truncate text-[3.6cqw] opacity-85">{label}</p>}
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="text-[3.2cqw] opacity-80">Made from my Instagram data export</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={copyStats}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-ig-secondary px-3 py-2 text-sm font-semibold text-fg hover:bg-ig-hover"
        >
          {copied ? <Check className="h-4 w-4 text-ig-good" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy stats"}
        </button>
        <button
          type="button"
          onClick={downloadPng}
          disabled={downloading}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-ig-blue px-3 py-2 text-sm font-semibold text-white hover:bg-ig-blue-hover disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {downloading ? "Saving…" : "Download"}
        </button>
      </div>
      {notice && (
        <p role="alert" className="text-xs text-ig-warn">
          {notice}
        </p>
      )}
    </div>
  );
}
