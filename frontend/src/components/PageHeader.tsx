import type { ReactNode } from "react";

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1
          className="text-xl font-semibold tracking-tight"
          style={{ color: "var(--ink)" }}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm" style={{ color: "var(--ink-mute)" }}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
