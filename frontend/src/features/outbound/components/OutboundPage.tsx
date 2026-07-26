import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { QueryFilterSelect } from "@/components/QueryFilterSelect";
import { getErrorMessage } from "@/lib/utils";
import {
  getProducts,
  getWarehouses,
} from "@/features/inventory/services/inventoryService";
import type { Product, Warehouse } from "@/features/inventory/types";
import type { OutboundStatus } from "@/features/outbound/types";
import { NewSalesOrderModal } from "@/features/outbound/components/NewSalesOrderModal";
import { NewTransferModal } from "@/features/outbound/components/NewTransferModal";
import { OutboundTableClient } from "@/features/outbound/components/OutboundTableClient";

const statusOptions: Array<{ value: OutboundStatus; label: string }> = [
  { value: "requested", label: "Requested" },
  { value: "picking", label: "Picking" },
  { value: "packed", label: "Packed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export async function OutboundPage({
  status,
  warehouseId,
}: {
  status?: OutboundStatus;
  warehouseId?: string;
}) {
  let warehouses: Warehouse[];
  let products: Product[];
  try {
    const [warehouseResult, productResult] = await Promise.all([
      getWarehouses(),
      getProducts(),
    ]);
    warehouses = warehouseResult;
    products = productResult.items;
  } catch (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Outbound" description="Sales orders, transfers and shipments" />
        <ErrorState message={getErrorMessage(error)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outbound"
        description="Sales orders, internal transfers and the pick > pack > ship flow"
        actions={
          <>
            <NewTransferModal warehouses={warehouses} products={products} />
            <NewSalesOrderModal warehouses={warehouses} products={products} />
          </>
        }
      />

      <Card
        title="Outbound requests"
        actions={
          <div className="flex items-center gap-2">
            <QueryFilterSelect
              param="warehouse_id"
              allLabel="All warehouses"
              options={warehouses.map((w) => ({
                value: String(w.id),
                label: w.name,
              }))}
              className="w-44"
            />
            <QueryFilterSelect
              param="status"
              allLabel="All statuses"
              options={statusOptions}
              className="w-36"
            />
          </div>
        }
        flush
      >
        <OutboundTableClient
          warehouses={warehouses}
          warehouseId={warehouseId}
          status={status}
        />
      </Card>
    </div>
  );
}
