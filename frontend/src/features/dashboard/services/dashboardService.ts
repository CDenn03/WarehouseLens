import { apiFetch } from "@/lib/api";
import type {
  AbcRankingRow,
  KpiSummary,
  StockTrendPoint,
} from "@/features/dashboard/types";

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
