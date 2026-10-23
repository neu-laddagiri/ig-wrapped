"use client";

import { Check } from "lucide-react";
import { Modal } from "@/components/ig/Modal";

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
  { label: "Media quality", value: "Any (Low is fastest)" },
];

interface ExportGuideModalProps {
  open: boolean;
  onClose: () => void;
}

/** Step-by-step instructions for requesting the Instagram data export. */
export function ExportGuideModal({ open, onClose }: ExportGuideModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Get your Instagram export" size="sm" bodyClassName="px-5 py-4">
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={step} className="flex gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ig-secondary text-xs font-semibold">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-6 rounded-xl border border-ig-border p-4">
        <p className="text-sm font-semibold">Recommended settings</p>
        <ul className="mt-2 divide-y divide-ig-border">
          {recommended.map((item) => (
            <li key={item.label} className="flex items-center justify-between py-2 text-sm">
              <span className="text-ig-muted">{item.label}</span>
              <span className="flex items-center gap-1.5 font-semibold">
                <Check className="h-4 w-4 text-ig-good" />
                {item.value}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-xs text-ig-muted">
        Instagram usually emails a download link within minutes to a few hours. Only the JSON
        files are read; photos and videos in the ZIP are ignored.
      </p>
    </Modal>
  );
}
