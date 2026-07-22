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
import { getOutboundRequests } from "@/features/outbound/services/outboundService";
import type { OutboundRequest, OutboundStatus } from "@/features/outbound/types";
import { NewSalesOrderModal } from "@/features/outbound/components/NewSalesOrderModal";
import { NewTransferModal } from "@/features/outbound/components/NewTransferModal";
import { OutboundTable } from "@/features/outbound/components/OutboundTable";

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
  let requests: OutboundRequest[];
  let warehouses: Warehouse[];
  let products: Product[];
  try {
    [requests, warehouses, products] = await Promise.all([
      getOutboundRequests({ status, warehouse_id: warehouseId }),
      getWarehouses(),
      getProducts(),
    ]);
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
        <OutboundTable requests={requests} warehouses={warehouses} />
      </Card>
    </div>
  );
}
