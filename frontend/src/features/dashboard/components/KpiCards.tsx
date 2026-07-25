import Link from "next/link";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import type { KpiSummary } from "@/features/dashboard/types";

interface KpiTile {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  accentVar: string;
  bgVar: string;
  borderVar: string;
  textVar: string;
  href?: string;
}

const iconClass = "h-5 w-5";

function TrendUp() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  );
}

function TrendNeutral() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
    </svg>
  );
}

function TrendDown() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
    </svg>
  );
}

export function KpiCards({ kpis }: { kpis: KpiSummary }) {
  const hasBelowReorder = kpis.skus_below_reorder_point > 0;

  const tiles: KpiTile[] = [
    {
      label: "Total inventory value",
      value: formatCurrency(kpis.total_inventory_value),
      hint: "On-hand quantity × unit cost",
      icon: (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-8.25-4.5L3.75 7.5m16.5 0v9l-8.25 4.5m8.25-13.5L12 12m-8.25-4.5v9L12 21m0-9v9" />
        </svg>
      ),
      accentVar: "var(--green-900)",
      bgVar: "var(--green-050)",
      borderVar: "var(--green-100)",
      textVar: "var(--green-900)",
      href: "/inventory",
    },
    {
      label: "SKUs below reorder",
      value: formatNumber(kpis.skus_below_reorder_point),
      hint: hasBelowReorder
        ? `${kpis.skus_below_reorder_point} SKU${kpis.skus_below_reorder_point > 1 ? "s" : ""} need procurement`
        : "All SKUs sufficiently stocked",
      icon: (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      ),
      accentVar: hasBelowReorder ? "var(--warning)" : "var(--success)",
      bgVar: hasBelowReorder ? "var(--warning-light)" : "var(--success-light)",
      borderVar: hasBelowReorder ? "var(--warning-border)" : "var(--success-border)",
      textVar: hasBelowReorder ? "var(--warning-text)" : "var(--success-text)",
      href: "/procurement",
    },
    {
      label: "Open outbound requests",
      value: formatNumber(kpis.open_outbound_requests),
      hint: "Requested, picking or packed",
      icon: (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m3 0h6m-9 0H3.375A1.125 1.125 0 012.25 17.625V6.375c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v11.25m4.5 1.125a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0m3 0h1.125c.621 0 1.125-.504 1.125-1.125v-4.072c0-.256-.088-.505-.248-.704l-2.472-3.09a1.125 1.125 0 00-.879-.421H14.25" />
        </svg>
      ),
      accentVar: "var(--info)",
      bgVar: "var(--info-light)",
      borderVar: "var(--info-border)",
      textVar: "var(--info-text)",
      href: "/outbound",
    },
  ];

  const trendIndicators = [
    { label: "All warehouses", trend: "up" as const },
    {
      label: hasBelowReorder ? "Requires attention" : "On target",
      trend: (hasBelowReorder ? "down" : "neutral") as "up" | "down" | "neutral",
    },
    { label: "Active workflow", trend: "up" as const },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {tiles.map((tile, i) => {
        const ti = trendIndicators[i];
        const TrendIcon =
          ti.trend === "up" ? TrendUp : ti.trend === "down" ? TrendDown : TrendNeutral;

        const inner = (
          <div className="flex h-full flex-col justify-between gap-3">
            {/* Top: icon + label */}
            <div className="flex items-start justify-between gap-2">
              <p
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: "var(--ink-mute)" }}
              >
                {tile.label}
              </p>
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: tile.bgVar, color: tile.accentVar }}
              >
                {tile.icon}
              </span>
            </div>

            {/* Value */}
            <p
              className="text-3xl font-bold tabular-nums leading-none"
              style={{ color: tile.textVar }}
            >
              {tile.value}
            </p>

            {/* Bottom: hint + trend badge */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs leading-snug" style={{ color: "var(--ink-mute)" }}>
                {tile.hint}
              </p>
              <span
                className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  background: tile.bgVar,
                  color: tile.textVar,
                }}
              >
                <TrendIcon />
                {ti.label}
              </span>
            </div>
          </div>
        );

        if (tile.href) {
          return (
            <Link
              key={tile.label}
              href={tile.href}
              className={cn(
                "block rounded-xl p-5 transition-shadow hover:shadow-md",
              )}
              style={{
                border: `1px solid ${tile.borderVar}`,
                background: "var(--panel)",
                boxShadow: "var(--shadow)",
              }}
            >
              {inner}
            </Link>
          );
        }

        return (
          <div
            key={tile.label}
            className="rounded-xl p-5"
            style={{
              border: `1px solid ${tile.borderVar}`,
              background: "var(--panel)",
              boxShadow: "var(--shadow)",
            }}
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
}
