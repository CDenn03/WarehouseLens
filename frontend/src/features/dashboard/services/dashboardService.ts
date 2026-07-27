import { apiFetch } from "@/lib/api";
import type { Warehouse } from "@/features/inventory/types";
import type { OutboundRequest } from "@/features/outbound/types";
import { outboundStatusTone } from "@/features/outbound/types";
import type {
  AbcRankingRow,
  KpiSummary,
  RecentActivity,
  StockTrendPoint,
  WarehouseHealth,
} from "@/features/dashboard/types";

// ── Core KPI / chart fetchers ──────────────────────────────────────────────

export function getKpis(warehouseId?: string): Promise<KpiSummary> {
  return apiFetch<KpiSummary>("/dashboard/kpis", {
    query: { warehouse_id: warehouseId },
  });
}

export function getStockTrend(
  warehouseId?: string,
  days = 30,
): Promise<StockTrendPoint[]> {
  return apiFetch<StockTrendPoint[]>("/dashboard/charts/stock-trend", {
    query: { warehouse_id: warehouseId, days },
  });
}

export function getAbcRanking(warehouseId?: string): Promise<AbcRankingRow[]> {
  return apiFetch<AbcRankingRow[]>("/dashboard/charts/abc-ranking", {
    query: { warehouse_id: warehouseId },
  });
}

// ── Warehouse health grid ──────────────────────────────────────────────────

/**
 * Builds a per-warehouse health summary by running KPI + outbound queries
 * for each warehouse in parallel.  Totals already exist on the global KPI
 * endpoint, so we reuse those — here we just need per-site breakdowns.
 */
export async function getWarehouseHealth(
  warehouses: Warehouse[],
): Promise<WarehouseHealth[]> {
  const results = await Promise.all(
    warehouses.map(async (w) => {
      const [kpis, outboundRequests] = await Promise.all([
        getKpis(String(w.id)).catch(() => ({
          total_inventory_value: 0,
          skus_below_reorder_point: 0,
          open_outbound_requests: 0,
        })),
        apiFetch<OutboundRequest[]>("/outbound-requests", {
          query: { warehouse_id: String(w.id) },
        }).catch(() => [] as OutboundRequest[]),
      ]);

      const openOutbound = outboundRequests.filter((r) =>
        ["requested", "picking", "packed"].includes(r.status),
      ).length;

      // Derive health level from SKUs below reorder and open outbound load
      let health: WarehouseHealth["health"] = "healthy";
      if (kpis.skus_below_reorder_point >= 5 || openOutbound >= 10) {
        health = "critical";
      } else if (kpis.skus_below_reorder_point > 0 || openOutbound >= 5) {
        health = "warning";
      }

      return {
        id: String(w.id),
        name: w.name,
        location: w.address ?? undefined,
        inventory_value: kpis.total_inventory_value,
        skus_below_reorder: kpis.skus_below_reorder_point,
        open_outbound: openOutbound,
        health,
      } satisfies WarehouseHealth;
    }),
  );

  return results;
}

// ── Recent activity feed ───────────────────────────────────────────────────

/** Returns the 10 most-recently-created outbound requests as activity items. */
export async function getRecentActivity(
  warehouseId?: string,
): Promise<RecentActivity[]> {
  const requests = await apiFetch<OutboundRequest[]>("/outbound-requests", {
    query: { warehouse_id: warehouseId },
  }).catch(() => [] as OutboundRequest[]);

  // Sort newest first; take up to 10
  const sorted = [...requests].sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return tb - ta;
  });

  return sorted.slice(0, 10).map((req): RecentActivity => {
    const isTransfer =
      req.destination_warehouse_id != null && req.sales_order_id == null;

    const type = isTransfer ? "transfer" : "outbound";

    const title = isTransfer
      ? `Transfer → ${req.destination_warehouse_name ?? "unknown"}`
      : req.sales_order_id
        ? `Order #${req.sales_order_id.slice(0, 8).toUpperCase()}`
        : `Outbound #${req.id.slice(0, 8).toUpperCase()}`;

    const subtitle = req.source_warehouse_name
      ? `From ${req.source_warehouse_name}`
      : `Request ${req.id.slice(0, 8).toUpperCase()}`;

    return {
      id: req.id,
      type,
      title,
      subtitle,
      status: req.status,
      statusTone: outboundStatusTone(req.status),
      occurredAt: req.created_at ?? null,
      warehouseName: req.source_warehouse_name,
      href: `/outbound/${req.id}`,
    };
  });
}
