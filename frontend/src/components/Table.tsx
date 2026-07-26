import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  /** Extra classes for both header and body cells (e.g. "text-right"). */
  className?: string;
  render: (row: T) => ReactNode;
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  /** Per-row class hook (e.g. to highlight rows below reorder point). */
  rowClassName?: (row: T) => string | undefined;
  isLoading?: boolean;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  emptyMessage = "Nothing here yet.",
  rowClassName,
  isLoading = false,
}: TableProps<T>) {
  return (
    <div className="relative w-full">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
          <div
            className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--border)", borderTopColor: "transparent" }}
          />
        </div>
      )}
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "var(--green-050)" }}>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide",
                  column.className,
                )}
                style={{ color: "var(--green-900)" }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm"
                style={{ color: "var(--ink-mute)" }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={rowKey(row)}
                className={cn(
                  "transition-colors hover:bg-brand-50",
                  rowClassName?.(row),
                )}
                style={{
                  background: index % 2 === 0 ? "var(--surface-panel)" : "var(--bg-alt)",
                  borderTop: "1px solid var(--border-soft)",
                }}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn("px-4 py-3", column.className)}
                    style={{ color: "var(--ink-soft)" }}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
