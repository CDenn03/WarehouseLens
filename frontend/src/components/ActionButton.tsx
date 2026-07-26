"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ActionButtonProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "danger";
  disabled?: boolean;
  className?: string;
}

export function ActionButton({
  icon,
  label,
  onClick,
  variant = "default",
  disabled = false,
  className,
}: ActionButtonProps) {
  return (
    <div className={cn("group relative inline-flex", className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center rounded-md p-1.5 transition-colors",
          variant === "danger"
            ? "hover:bg-red-50 disabled:opacity-30"
            : "hover:bg-brand-50 disabled:opacity-30",
          disabled && "cursor-not-allowed",
        )}
        aria-label={label}
      >
        {icon}
      </button>
      <span
        className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium opacity-0 shadow-md transition-opacity group-hover:opacity-100"
        style={{
          background: "var(--green-900)",
          color: "var(--ink-on-brand)",
        }}
        role="tooltip"
      >
        {label}
      </span>
    </div>
  );
}
