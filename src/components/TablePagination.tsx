"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PageSize } from "@/types/instagram";
import { PAGE_SIZE_OPTIONS } from "@/types/instagram";

interface TablePaginationProps {
  total: number;
  page: number;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

export function TablePagination({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-ig-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-ig-muted">
        Showing {start}–{end} of {total.toLocaleString()} accounts
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-ig-muted">
          Per page
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value) as PageSize);
              onPageChange(1);
            }}
            className="rounded-lg border border-ig-border bg-ig-secondary px-2 py-1 text-fg outline-none"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
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
            aria-label="Previous page"
            className="rounded-lg border border-ig-border p-2 text-fg transition hover:bg-ig-hover disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className="min-w-[4rem] text-center text-xs text-ig-muted" aria-live="polite">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            aria-label="Next page"
            className="rounded-lg border border-ig-border p-2 text-fg transition hover:bg-ig-hover disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Clamps `page` to the last page so a shrunken list never renders empty. */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
