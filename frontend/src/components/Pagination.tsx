"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50, 100],
  onPageSizeChange,
  className,
}: PaginationProps) {
  if (total === 0) return null;

  const pages: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("...");
    for (
      let i = Math.max(2, page - 1);
      i <= Math.min(totalPages - 1, page + 1);
      i++
    ) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between border-t px-4 py-3 text-sm",
        className,
      )}
      style={{ borderColor: "var(--border-soft)" }}
    >
      <div className="flex items-center gap-3">
        <span style={{ color: "var(--ink-mute)" }}>
          {total} result{total === 1 ? "" : "s"}
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs" style={{ color: "var(--ink-mute)" }}>
              Rows per page:
            </span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded border px-1.5 py-0.5 text-xs focus:border-brand-300 focus:outline-none focus:ring-1 focus:ring-brand-300"
              style={{
                borderColor: "var(--border)",
                background: "var(--surface-panel)",
                color: "var(--ink)",
              }}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={page === 1}
            className="rounded p-1 transition-colors hover:bg-brand-50 disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="rounded p-1 transition-colors hover:bg-brand-50 disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />
          </button>
          {pages.map((p, i) =>
            p === "..." ? (
              <span
                key={`ellipsis-${i}`}
                className="px-1 text-xs"
                style={{ color: "var(--ink-mute)" }}
              >
                ...
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={cn(
                  "min-w-[28px] rounded px-2 py-1 text-xs font-medium transition-colors",
                  p === page
                    ? "text-ink-on-brand"
                    : "hover:bg-brand-50",
                )}
                style={
                  p === page
                    ? { background: "var(--green-900)", color: "var(--ink-on-brand)" }
                    : { color: "var(--ink-soft)" }
                }
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="rounded p-1 transition-colors hover:bg-brand-50 disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={page === totalPages}
            className="rounded p-1 transition-colors hover:bg-brand-50 disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />
          </button>
        </div>
      )}
    </div>
  );
}
