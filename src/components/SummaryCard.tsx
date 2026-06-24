"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface SummaryCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: LucideIcon;
  accent?: "orange" | "pink" | "purple" | "blue" | "green";
}

const accentStyles = {
  orange: "from-[#F58529]/30 to-[#F58529]/5 text-[#F58529]",
  pink: "from-[#DD2A7B]/30 to-[#DD2A7B]/5 text-[#DD2A7B]",
  purple: "from-[#8134AF]/30 to-[#8134AF]/5 text-[#c084fc]",
  blue: "from-[#515BD4]/30 to-[#515BD4]/5 text-[#818cf8]",
  green: "from-emerald-500/30 to-emerald-500/5 text-emerald-400",
};

export function SummaryCard({
  label,
  value,
  sublabel,
  icon: Icon,
  accent = "pink",
}: SummaryCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/40">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white">
            {value}
          </p>
          {sublabel && (
            <p className="mt-1 text-xs text-white/40">{sublabel}</p>
          )}
        </div>
        {Icon && (
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${accentStyles[accent]}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
