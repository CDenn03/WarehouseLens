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
