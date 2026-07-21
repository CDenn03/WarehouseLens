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
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            {title && (
              <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}
