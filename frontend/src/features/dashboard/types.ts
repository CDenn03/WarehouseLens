/** Dashboard feature types (GET /dashboard/*). */

export interface KpiSummary {
  total_inventory_value: number;
  skus_below_reorder_point: number;
  open_outbound_requests: number;
}

export interface StockTrendPoint {
  date: string;
  total_quantity_on_hand: number;
}

export type AbcClass = "A" | "B" | "C";

export interface AbcRankingRow {
  sku: string;
  name: string;
  inventory_value: number;
  /** Cumulative share of total inventory value, 0..1. */
  cumulative_share: number;
  abc_class: AbcClass;
}

// ── Extended types for the enriched dashboard ──────────────────────────────

/** Per-warehouse health card, assembled client-side from existing endpoints. */
export interface WarehouseHealth {
  id: string;
  name: string;
  location?: string;
  /** Total inventory value (USD) for this warehouse. */
  inventory_value: number;
  /** SKUs whose quantity_on_hand < reorder_point in this warehouse. */
  skus_below_reorder: number;
  /** Open outbound requests (requested | picking | packed) for this warehouse. */
  open_outbound: number;
  /** Derived health level. */
  health: "healthy" | "warning" | "critical";
}

/** A single line in the recent-activity feed, assembled from outbound requests. */
export interface RecentActivity {
  id: string;
  type: "outbound" | "transfer" | "reorder";
  title: string;
  subtitle: string;
  status: string;
  statusTone: "slate" | "amber" | "brand" | "blue" | "green" | "red";
  occurredAt: string | null;
  warehouseName?: string;
  href: string;
}
