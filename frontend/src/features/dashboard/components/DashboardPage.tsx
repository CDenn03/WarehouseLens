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
  getRecentActivity,
  getStockTrend,
  getWarehouseHealth,
} from "@/features/dashboard/services/dashboardService";
import type {
  AbcRankingRow,
  KpiSummary,
  RecentActivity,
  StockTrendPoint,
  WarehouseHealth,
} from "@/features/dashboard/types";
import { AbcRankingChart } from "@/features/dashboard/components/AbcRankingChart";
import { CopilotEntryCard } from "@/features/dashboard/components/CopilotEntryCard";
import { KpiCards } from "@/features/dashboard/components/KpiCards";
import { RecentActivityFeed } from "@/features/dashboard/components/RecentActivityFeed";
import { StockTrendChart } from "@/features/dashboard/components/StockTrendChart";
import { WarehouseHealthGrid } from "@/features/dashboard/components/WarehouseHealthGrid";

export async function DashboardPage({ warehouseId }: { warehouseId?: string }) {
  let kpis: KpiSummary;
  let trend: StockTrendPoint[];
  let abcRanking: AbcRankingRow[];
  let warehouses: Warehouse[];
  let warehouseHealth: WarehouseHealth[];
  let recentActivity: RecentActivity[];

  try {
    // Fetch the fast, independent queries first in parallel
    [kpis, trend, abcRanking, warehouses, recentActivity] = await Promise.all([
      getKpis(warehouseId),
      getStockTrend(warehouseId, 30),
      getAbcRanking(warehouseId),
      getWarehouses(),
      getRecentActivity(warehouseId),
    ]);
    // Warehouse health requires the warehouse list first
    warehouseHealth = await getWarehouseHealth(warehouses);
  } catch (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Warehouse operations at a glance" />
        <ErrorState message={getErrorMessage(error)} />
      </div>
    );
  }

  const scopeName = warehouseId
    ? (warehouses.find((w) => String(w.id) === warehouseId)?.name ?? "Selected warehouse")
    : "All warehouses";

  // Summary counts for the header meta line
  const criticalWarehouses = warehouseHealth.filter((w) => w.health === "critical").length;
  const warningWarehouses = warehouseHealth.filter((w) => w.health === "warning").length;
  const alertSuffix =
    criticalWarehouses > 0
      ? ` · ${criticalWarehouses} critical`
      : warningWarehouses > 0
        ? ` · ${warningWarehouses} need attention`
        : ` · all sites healthy`;

  return (
    <div className="space-y-8">
      {/* ── Page header ── */}
      <PageHeader
        title="Dashboard"
        description={`${scopeName}${alertSuffix}`}
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

      {/* ── KPI row ── */}
      <KpiCards kpis={kpis} />

      {/* ── Warehouse health grid ── */}
      {!warehouseId && (
        <section aria-label="Warehouse health">
          <div className="mb-3 flex items-center gap-2">
            <h2
              className="text-sm font-semibold"
              style={{ color: "var(--ink)" }}
            >
              Warehouse health
            </h2>
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{
                background: "var(--green-050)",
                color: "var(--green-900)",
              }}
            >
              {warehouses.length} sites
            </span>
          </div>
          <WarehouseHealthGrid warehouses={warehouseHealth} />
        </section>
      )}

      {/* ── Charts + right-column ── */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Left 2/3: charts stacked */}
        <div className="space-y-6 xl:col-span-2">
          <Card
            title="Stock trend"
            description="Total units on hand, last 30 days"
          >
            <StockTrendChart data={trend} />
          </Card>
          <Card
            title="ABC ranking"
            description="SKUs by inventory value · A = top 80%, B = next 15%, C = tail"
          >
            <AbcRankingChart data={abcRanking} />
          </Card>
        </div>

        {/* Right 1/3: activity + copilot */}
        <div className="flex flex-col gap-6">
          <CopilotEntryCard />

          <Card
            title="Recent activity"
            description="Latest outbound movements"
            flush
          >
            <RecentActivityFeed activities={recentActivity} />
          </Card>
        </div>
      </div>
    </div>
  );
}
