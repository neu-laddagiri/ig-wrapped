"use client";

import { useEffect, useState } from "react";
import {
  loadAccountCrm,
  saveAccountCrmEntry,
  CRM_STATUS_LABELS,
  type AccountCrmStatus,
} from "@/lib/accountCrm";

interface AccountCrmPanelProps {
  fingerprint: string;
  username: string;
}

export function AccountCrmPanel({ fingerprint, username }: AccountCrmPanelProps) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<AccountCrmStatus>("not-reviewed");

  useEffect(() => {
    const entry = loadAccountCrm(fingerprint)[username];
    if (entry) {
      setNote(entry.note ?? "");
      setStatus(entry.status);
    } else {
      setNote("");
      setStatus("not-reviewed");
    }
  }, [fingerprint, username]);

  const persist = (nextNote: string, nextStatus: AccountCrmStatus) => {
    saveAccountCrmEntry(fingerprint, {
      username,
      note: nextNote,
      tags: [],
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">
        Private notes
      </p>
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          persist(e.target.value, status);
        }}
        rows={2}
        placeholder="Your private note…"
        className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/30"
      />
      <label className="mt-2 block text-[10px] text-white/40">Status</label>
      <select
        value={status}
        onChange={(e) => {
          const v = e.target.value as AccountCrmStatus;
          setStatus(v);
          persist(note, v);
        }}
        className="mt-1 w-full rounded-lg border border-white/10 bg-[#12121a] px-2 py-1.5 text-xs text-white"
      >
        {Object.entries(CRM_STATUS_LABELS).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
      <p className="mt-2 text-[10px] text-white/30">
        Stored locally on this device. Included when you save analysis if CRM
        sync is enabled in a future update.
      </p>
    </div>
  );
}
