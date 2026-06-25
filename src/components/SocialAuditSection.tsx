"use client";

import type { SocialAuditItem } from "@/types/insights";
import { ConfidencePill } from "@/components/ConfidencePill";

interface SocialAuditSectionProps {
  items: SocialAuditItem[];
}

export function SocialAuditSection({ items }: SocialAuditSectionProps) {
  if (!items.length) return null;

  const green = items.filter((i) => i.tone === "green");
  const red = items.filter((i) => i.tone === "red");

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h3 className="font-semibold text-white">Red Flag / Green Flag Audit</h3>
      <p className="mt-1 text-xs text-white/40">For fun only — not professional advice.</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <FlagColumn title="Green flags" items={green} tone="green" />
        <FlagColumn title="Red flags" items={red} tone="red" />
      </div>
    </div>
  );
}

function FlagColumn({
  title,
  items,
  tone,
}: {
  title: string;
  items: SocialAuditItem[];
  tone: "green" | "red";
}) {
  if (!items.length) {
    return (
      <div>
        <p className="mb-2 text-xs font-semibold text-white/50">{title}</p>
        <p className="text-xs text-white/35">None flagged.</p>
      </div>
    );
  }
  return (
    <div>
      <p
        className={`mb-2 text-xs font-semibold ${
          tone === "green" ? "text-emerald-400/90" : "text-amber-400/90"
        }`}
      >
        {title}
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-white">{item.label}</p>
              <ConfidencePill level={item.confidence} />
            </div>
            <p className="mt-1 text-xs text-white/45">{item.explanation}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
