import { Badge } from "@/components/Badge";
import { Table } from "@/components/Table";
import type { Column } from "@/components/Table";
import { formatDate } from "@/lib/utils";
import type { PurchaseOrder } from "@/features/procurement/types";
import { purchaseOrderStatusTone } from "@/features/procurement/types";
import { ReceivePurchaseOrderButton } from "@/features/procurement/components/ReceivePurchaseOrderButton";

// The API returns supplier/warehouse IDs, not names — resolve via lookups the
// procurement page already has from getSuppliers() / getWarehouses().
function buildColumns(
  supplierName: (id: string) => string | undefined,
  warehouseName: (id: string) => string | undefined,
): Column<PurchaseOrder>[] {
  return [
    {
      key: "id",
      header: "PO",
      render: (po) => (
        <span className="font-medium text-slate-900">
          #{String(po.id).slice(0, 8)}
        </span>
      ),
    },
    {
      key: "supplier",
      header: "Supplier",
      render: (po) => supplierName(String(po.supplier_id)) ?? po.supplier_id,
    },
    {
      key: "destination",
      header: "Destination",
      render: (po) =>
        warehouseName(String(po.destination_warehouse_id)) ??
        po.destination_warehouse_id,
    },
    {
      key: "order_date",
      header: "Ordered",
      render: (po) => formatDate(po.order_date),
    },
    {
      key: "expected",
      header: "Expected",
      render: (po) => formatDate(po.expected_delivery_date),
    },
    {
      key: "status",
      header: "Status",
      render: (po) => (
        <Badge tone={purchaseOrderStatusTone(po.status)}>{po.status}</Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (po) =>
        po.status === "pending" || po.status === "confirmed" ? (
          <ReceivePurchaseOrderButton purchaseOrderId={String(po.id)} />
        ) : null,
    },
  ];
}

export function PurchaseOrdersTable({
  orders,
  suppliers = [],
  warehouses = [],
}: {
  orders: PurchaseOrder[];
  suppliers?: Array<{ id: string; name: string }>;
  warehouses?: Array<{ id: string; name: string }>;
}) {
  const supplierNames = new Map(suppliers.map((s) => [String(s.id), s.name]));
  const warehouseNames = new Map(warehouses.map((w) => [String(w.id), w.name]));
  return (
    <Table
      columns={buildColumns(
        (id) => supplierNames.get(id),
        (id) => warehouseNames.get(id),
      )}
      rows={orders}
      rowKey={(po) => String(po.id)}
      emptyMessage="No purchase orders match the current filters."
    />
  );
}
