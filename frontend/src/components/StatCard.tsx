import type { ReactNode } from "react";

export interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
}

/** Single KPI tile: icon, label, value, supporting hint. */
export function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: "var(--panel)",
        border: "1px solid var(--border-soft)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: "var(--green-050)", color: "var(--green-900)" }}
        >
          {icon}
        </span>
        <div>
          <p
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: "var(--ink-mute)" }}
          >
            {label}
          </p>
          <p
            className="text-2xl font-bold tabular-nums"
            style={{ color: "var(--green-900)" }}
          >
            {value}
          </p>
        </div>
      </div>
      {hint && (
        <p className="mt-2 text-xs" style={{ color: "var(--ink-mute)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
