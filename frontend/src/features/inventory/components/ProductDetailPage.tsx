import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { formatCurrency, getErrorMessage } from "@/lib/utils";
import {
  getForecast,
  getProducts,
  getProductStock,
  getTransactions,
  getWarehouses,
} from "@/features/inventory/services/inventoryService";
import type {
  Forecast,
  InventoryTransaction,
  Product,
  ProductStock,
  Warehouse,
} from "@/features/inventory/types";
import { AdjustmentForm } from "@/features/inventory/components/AdjustmentForm";
import { ForecastChart } from "@/features/inventory/components/ForecastChart";
import { StockBreakdownTable } from "@/features/inventory/components/StockBreakdownTable";
import { TransactionsTable } from "@/features/inventory/components/TransactionsTable";

export async function ProductDetailPage({ productId }: { productId: string }) {
  let products: Product[];
  let stock: ProductStock[];
  let warehouses: Warehouse[];
  let transactions: InventoryTransaction[];
  try {
    [products, stock, warehouses, transactions] = await Promise.all([
      getProducts(),
      getProductStock(productId),
      getWarehouses(),
      getTransactions({ product_id: productId }),
    ]);
  } catch (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Product detail" />
        <ErrorState message={getErrorMessage(error)} />
      </div>
    );
  }

  const product = products.find((p) => String(p.id) === String(productId));
  if (!product) {
    return (
      <div className="space-y-6">
        <PageHeader title="Product detail" />
        <ErrorState
          title="Product not found"
          message={`No product with id "${productId}" exists.`}
        />
      </div>
    );
  }

  // Forecasts are per-warehouse (Section 13.4), so the product-level view has to
  // pick one — use the warehouse holding the most stock, which also has the most
  // demand history to forecast from. Degrade gracefully if the model is
  // unavailable (new SKU, no history).
  const forecastRow = [...stock].sort(
    (a, b) => b.quantity_on_hand - a.quantity_on_hand,
  )[0];
  let forecast: Forecast | null = null;
  let forecastError: string | null = null;
  let forecastWarehouseName: string | null = null;
  if (forecastRow) {
    forecastWarehouseName = forecastRow.warehouse_name;
    try {
      forecast = await getForecast(productId, {
        warehouseId: forecastRow.warehouse_id,
        horizon: 30,
      });
    } catch (error) {
      forecastError = getErrorMessage(error, "Forecast unavailable.");
    }
  }

  const belowReorder = stock.filter(
    (row) => row.quantity_on_hand < row.reorder_point,
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={`${product.category} · Unit cost ${formatCurrency(product.unit_cost)}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="brand">{product.sku}</Badge>
            {belowReorder > 0 && (
              <Badge tone="red">
                {belowReorder} warehouse{belowReorder === 1 ? "" : "s"} below
                reorder point
              </Badge>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card
            title="Stock by warehouse"
            description="Rows highlighted in red are below their reorder point"
            flush
          >
            <StockBreakdownTable rows={stock} />
          </Card>

          <Card
            title="Demand forecast (30 days)"
            description={
              forecast
                ? `${forecastWarehouseName} · model: ${forecast.model}`
                : forecastWarehouseName
                  ? `${forecastWarehouseName}`
                  : undefined
            }
          >
            {forecast && forecast.points.length > 0 ? (
              <ForecastChart points={forecast.points} />
            ) : (
              <p className="py-6 text-center text-sm text-slate-400">
                {forecastError ?? "No forecast points returned for this product."}
              </p>
            )}
          </Card>

          <Card title="Recent transactions" flush>
            <TransactionsTable
              rows={transactions.slice(0, 20)}
              warehouses={warehouses}
            />
          </Card>
        </div>

        <div>
          <Card
            title="Manual adjustment"
            description="Record a correction, damage write-off or ad-hoc receipt"
          >
            <AdjustmentForm productId={String(product.id)} warehouses={warehouses} />
          </Card>
        </div>
      </div>
    </div>
  );
}
