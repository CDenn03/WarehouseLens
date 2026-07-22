import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "slate"
  | "green"
  | "amber"
  | "red"
  | "brand"
  | "blue";

const toneClasses: Record<BadgeTone, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  // Uses brand green — the primary tone
  brand: "text-[#f4f3ee] ring-transparent",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
};

const toneStyle: Partial<Record<BadgeTone, React.CSSProperties>> = {
  brand: { background: "var(--green-900)" },
};

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = "slate", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",
        toneClasses[tone],
        className,
      )}
      style={toneStyle[tone]}
    >
      {children}
    </span>
  );
}
