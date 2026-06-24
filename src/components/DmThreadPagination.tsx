"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  DM_PAGE_SIZE_OPTIONS,
  type DmPageSize,
} from "@/lib/dmThreads";

interface DmThreadPaginationProps {
  total: number;
  page: number;
  pageSize: DmPageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: DmPageSize) => void;
}

export function DmThreadPagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: DmThreadPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-white/40">
        Showing {start}–{end} of {total.toLocaleString()} threads
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-white/50">
          Per page
          <select
            value={pageSize}
            onChange={(e) =>
              onPageSizeChange(Number(e.target.value) as DmPageSize)
            }
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white outline-none"
          >
            {DM_PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-white/60 transition hover:bg-white/5 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[4rem] text-center text-xs text-white/50">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-white/60 transition hover:bg-white/5 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
