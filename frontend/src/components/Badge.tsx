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
  slate: "bg-brand-100 text-ink-soft ring-brand-300",
  brand: "text-ink-on-brand ring-transparent",
  green: "bg-success-light text-success-text ring-success-border",
  amber: "bg-warning-light text-warning-text ring-warning-border",
  red: "bg-error-light text-error-text ring-error-border",
  blue: "bg-info-light text-info-text ring-info-border",
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
