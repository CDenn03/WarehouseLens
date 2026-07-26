import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { QueryFilterSelect } from "@/components/QueryFilterSelect";
import { getErrorMessage } from "@/lib/utils";
import {
  getProducts,
  getWarehouses,
  type PaginatedResponse,
} from "@/features/inventory/services/inventoryService";
import type { Product, Warehouse } from "@/features/inventory/types";
import {
  getSuppliers,
} from "@/features/procurement/services/procurementService";
import type {
  PurchaseOrderStatus,
  Supplier,
} from "@/features/procurement/types";
import { CreatePurchaseOrderModal } from "@/features/procurement/components/CreatePurchaseOrderModal";
import { NewSupplierModal } from "@/features/procurement/components/NewSupplierModal";
import { PurchaseOrdersTableClient } from "@/features/procurement/components/PurchaseOrdersTableClient";
import { SuppliersList } from "@/features/procurement/components/SuppliersList";

const statusOptions: Array<{ value: PurchaseOrderStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

export async function ProcurementPage({
  status,
  warehouseId,
}: {
  status?: PurchaseOrderStatus;
  warehouseId?: string;
}) {
  let suppliers: Supplier[];
  let warehouses: Warehouse[];
  let products: PaginatedResponse<Product>;
  try {
    [suppliers, warehouses, products] = await Promise.all([
      getSuppliers(),
      getWarehouses(),
      getProducts(),
    ]);
  } catch (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Procurement" description="Suppliers and purchase orders" />
        <ErrorState message={getErrorMessage(error)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procurement"
        description="Suppliers and inbound purchase orders"
        actions={
          <>
            <NewSupplierModal />
            <CreatePurchaseOrderModal
              suppliers={suppliers}
              warehouses={warehouses}
              products={products.items}
            />
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card
            title="Purchase orders"
            description="Receive pending or confirmed orders to book stock in"
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
            <PurchaseOrdersTableClient
              suppliers={suppliers}
              warehouses={warehouses}
              warehouseId={warehouseId}
              status={status}
            />
          </Card>
        </div>
        <div>
          <Card title="Suppliers" flush>
            <SuppliersList suppliers={suppliers} />
          </Card>
        </div>
      </div>
    </div>
  );
}
