import Link from "next/link";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { WarehouseHealth } from "@/features/dashboard/types";

interface Props {
  warehouses: WarehouseHealth[];
}

const healthConfig = {
  healthy: {
    dot: "bg-[var(--success)]",
    badge: "bg-[var(--success-light)] text-[var(--success-text)] ring-[var(--success-border)]",
    label: "Healthy",
  },
  warning: {
    dot: "bg-[var(--warning)]",
    badge: "bg-[var(--warning-light)] text-[var(--warning-text)] ring-[var(--warning-border)]",
    label: "Needs attention",
  },
  critical: {
    dot: "bg-[var(--error)]",
    badge: "bg-[var(--error-light)] text-[var(--error-text)] ring-[var(--error-border)]",
    label: "Critical",
  },
} as const;

function HealthBadge({ health }: { health: WarehouseHealth["health"] }) {
  const cfg = healthConfig[health];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.badge}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function StatPill({
  value,
  label,
  alert,
}: {
  value: string;
  label: string;
  alert?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="text-lg font-semibold tabular-nums leading-none"
        style={{ color: alert ? "var(--error)" : "var(--ink)" }}
      >
        {value}
      </span>
      <span className="text-[11px] leading-tight" style={{ color: "var(--ink-mute)" }}>
        {label}
      </span>
    </div>
  );
}

export function WarehouseHealthGrid({ warehouses }: Props) {
  if (warehouses.length === 0) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: "var(--ink-mute)" }}>
        No warehouses configured.
      </p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {warehouses.map((w) => (
        <Link
          key={w.id}
          href={`/dashboard?warehouse_id=${w.id}`}
          className="group block rounded-xl p-4 transition-shadow hover:shadow-md"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border-soft)",
          }}
        >
          {/* Header row */}
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p
                className="truncate text-sm font-semibold group-hover:underline"
                style={{ color: "var(--ink)" }}
              >
                {w.name}
              </p>
              {w.location && (
                <p
                  className="mt-0.5 truncate text-xs"
                  style={{ color: "var(--ink-mute)" }}
                >
                  {w.location}
                </p>
              )}
            </div>
            <HealthBadge health={w.health} />
          </div>

          {/* Stats row */}
          <div
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5"
            style={{ background: "var(--bg-alt)" }}
          >
            <StatPill
              value={formatCurrency(w.inventory_value)}
              label="Inv. value"
            />
            <div
              className="h-8 w-px"
              style={{ background: "var(--border-soft)" }}
              aria-hidden="true"
            />
            <StatPill
              value={formatNumber(w.skus_below_reorder)}
              label="Below reorder"
              alert={w.skus_below_reorder > 0}
            />
            <div
              className="h-8 w-px"
              style={{ background: "var(--border-soft)" }}
              aria-hidden="true"
            />
            <StatPill
              value={formatNumber(w.open_outbound)}
              label="Open outbound"
            />
          </div>
        </Link>
      ))}
    </div>
  );
}
