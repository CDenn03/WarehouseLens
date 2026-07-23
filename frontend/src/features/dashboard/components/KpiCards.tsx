import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import type { KpiSummary } from "@/features/dashboard/types";

interface KpiTile {
  label: string;
  value: string;
  hint: string;
  accentClassName: string;
}

export function KpiCards({ kpis }: { kpis: KpiSummary }) {
  const tiles: KpiTile[] = [
    {
      label: "Total inventory value",
      value: formatCurrency(kpis.total_inventory_value),
      hint: "On-hand quantity × unit cost",
      accentClassName: "text-brand-900",
    },
    {
      label: "SKUs below reorder point",
      value: formatNumber(kpis.skus_below_reorder_point),
      hint:
        kpis.skus_below_reorder_point > 0
          ? "Needs procurement attention"
          : "All SKUs sufficiently stocked",
      accentClassName:
        kpis.skus_below_reorder_point > 0 ? "text-warning" : "text-success",
    },
    {
      label: "Open outbound requests",
      value: formatNumber(kpis.open_outbound_requests),
      hint: "Requested, picking or packed",
      accentClassName: "text-info",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-xl border border-brand-100 bg-surface-panel p-5 shadow-sm"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-ink-mute">
            {tile.label}
          </p>
          <p
            className={cn(
              "mt-2 text-2xl font-semibold tabular-nums",
              tile.accentClassName,
            )}
          >
            {tile.value}
          </p>
          <p className="mt-1 text-xs text-ink-mute">{tile.hint}</p>
        </div>
      ))}
    </div>
  );
}
