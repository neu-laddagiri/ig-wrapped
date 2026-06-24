"use client";

import { motion } from "framer-motion";
import { Download, CheckCircle2 } from "lucide-react";

const steps = [
  "Open Instagram or Meta Accounts Center.",
  "Go to Your information and permissions.",
  "Choose Export your information.",
  "Select your Instagram profile.",
  "Choose Export to device.",
  "Set Date range to All time.",
  "Set Format to JSON.",
  "Choose media quality. Low or Medium is faster; High includes larger media files.",
  "Start the export and wait for Instagram to prepare the download.",
  "Download the ZIP file and upload it here.",
];

const recommended = [
  { label: "Date range", value: "All time" },
  { label: "Format", value: "JSON" },
  { label: "Destination", value: "Export to device" },
  { label: "Media quality", value: "Any (Low/Medium faster)" },
];

export function ExportGuide() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm sm:p-8"
    >
      <div className="flex items-center gap-2">
        <Download className="h-5 w-5 text-[#F58529]" />
        <h2 className="text-xl font-semibold text-white">
          How to get your Instagram export
        </h2>
      </div>

      <ol className="mt-6 space-y-3">
        {steps.map((step, i) => (
          <li key={step} className="flex gap-3 text-sm text-white/55">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-medium text-white/50">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-sm font-medium text-white">Recommended settings</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {recommended.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2"
            >
              <span className="text-xs text-white/40">{item.label}</span>
              <span className="flex items-center gap-1.5 text-xs font-medium text-white/80">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
