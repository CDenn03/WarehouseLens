import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CardProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Remove inner padding (useful when the card body is a full-bleed table). */
  flush?: boolean;
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  flush = false,
}: CardProps) {
  return (
    <section
      className={cn("rounded-xl bg-[var(--panel)]", className)}
      style={{ border: "1px solid var(--border-soft)", boxShadow: "var(--shadow)" }}
    >
      {(title || actions) && (
        <div
          className="flex items-start justify-between gap-4 px-5 py-4"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div>
            {title && (
              <h2
                className="text-sm font-semibold"
                style={{ color: "var(--ink)" }}
              >
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs" style={{ color: "var(--ink-mute)" }}>
                {description}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}
