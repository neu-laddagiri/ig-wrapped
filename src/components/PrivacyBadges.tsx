"use client";

import { Lock, HardDrive, Cloud } from "lucide-react";
import { motion } from "framer-motion";

const badges = [
  {
    icon: Lock,
    label: "No login required",
    description: "Analyze exports without an account",
  },
  {
    icon: HardDrive,
    label: "ZIP parsed locally",
    description: "Your ZIP stays in your browser while parsing",
  },
  {
    icon: Cloud,
    label: "Optional cloud save",
    description: "Sign in only to save your full analysis",
  },
];

export function PrivacyBadges() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {badges.map((badge, i) => (
        <motion.div
          key={badge.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 + i * 0.08 }}
          className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#F58529]/20 via-[#DD2A7B]/20 to-[#515BD4]/20">
            <badge.icon className="h-4 w-4 text-[#DD2A7B]" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{badge.label}</p>
            <p className="mt-0.5 text-xs text-white/45">{badge.description}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
