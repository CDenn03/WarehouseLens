import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { QueryFilterSelect } from "@/components/QueryFilterSelect";
import { getErrorMessage } from "@/lib/utils";
import { getWarehouses } from "@/features/inventory/services/inventoryService";
import type { Warehouse } from "@/features/inventory/types";
import {
  getAbcRanking,
  getKpis,
  getStockTrend,
} from "@/features/dashboard/services/dashboardService";
import type {
  AbcRankingRow,
  KpiSummary,
  StockTrendPoint,
} from "@/features/dashboard/types";
import { AbcRankingChart } from "@/features/dashboard/components/AbcRankingChart";
import { KpiCards } from "@/features/dashboard/components/KpiCards";
import { StockTrendChart } from "@/features/dashboard/components/StockTrendChart";

export async function DashboardPage({ warehouseId }: { warehouseId?: string }) {
  let kpis: KpiSummary;
  let trend: StockTrendPoint[];
  let abcRanking: AbcRankingRow[];
  let warehouses: Warehouse[];
  try {
    [kpis, trend, abcRanking, warehouses] = await Promise.all([
      getKpis(warehouseId),
      getStockTrend(warehouseId, 30),
      getAbcRanking(warehouseId),
      getWarehouses(),
    ]);
  } catch (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Warehouse operations at a glance" />
        <ErrorState message={getErrorMessage(error)} />
      </div>
    );
  }

  const scopeName = warehouseId
    ? warehouses.find((w) => String(w.id) === warehouseId)?.name ?? "Selected warehouse"
    : "All warehouses";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Warehouse operations at a glance · ${scopeName}`}
        actions={
          <QueryFilterSelect
            param="warehouse_id"
            allLabel="All warehouses"
            options={warehouses.map((w) => ({
              value: String(w.id),
              label: w.name,
            }))}
            className="w-56"
          />
        }
      />

      <KpiCards kpis={kpis} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card
          title="Stock trend"
          description="Total units on hand, last 30 days"
        >
          <StockTrendChart data={trend} />
        </Card>
        <Card
          title="ABC ranking"
          description="SKUs by inventory value with ABC classification"
        >
          <AbcRankingChart data={abcRanking} />
        </Card>
      </div>
    </div>
  );
}
