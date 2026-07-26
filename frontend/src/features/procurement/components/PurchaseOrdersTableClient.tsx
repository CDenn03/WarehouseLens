"use client";

import { Badge } from "@/components/Badge";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { Table } from "@/components/Table";
import type { Column } from "@/components/Table";
import { useTableData } from "@/hooks/useTableData";
import { formatDate } from "@/lib/utils";
import type { PurchaseOrder } from "@/features/procurement/types";
import { purchaseOrderStatusTone } from "@/features/procurement/types";
import { ReceivePurchaseOrderButton } from "@/features/procurement/components/ReceivePurchaseOrderButton";

interface LookupTable {
  id: string;
  name: string;
}

function buildColumns(
  supplierName: (id: string) => string | undefined,
  warehouseName: (id: string) => string | undefined,
): Column<PurchaseOrder>[] {
  return [
    {
      key: "id",
      header: "PO",
      render: (po) => (
        <span className="font-medium text-ink">
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

export function PurchaseOrdersTableClient({
  suppliers = [],
  warehouses = [],
  warehouseId,
  status,
}: {
  suppliers?: LookupTable[];
  warehouses?: LookupTable[];
  warehouseId?: string;
  status?: string;
}) {
  const filters: Record<string, string> = {};
  if (warehouseId) filters.warehouse_id = warehouseId;
  if (status) filters.status = status;

  const {
    data,
    total,
    page,
    totalPages,
    isLoading,
    error,
    search,
    setSearch,
    goToPage,
  } = useTableData<PurchaseOrder>("/purchase-orders", {
    pageSize: 20,
    defaultSortBy: "created_at",
    defaultSortOrder: "desc",
  });

  const supplierNames = new Map(suppliers.map((s) => [String(s.id), s.name]));
  const warehouseNames = new Map(warehouses.map((w) => [String(w.id), w.name]));

  return (
    <>
      <div className="flex items-center gap-4 border-b px-4 py-3" style={{ borderColor: "var(--border-soft)" }}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search purchase orders..."
          className="flex-1"
        />
      </div>
      {error && (
        <div className="px-4 py-3 text-sm" style={{ color: "var(--error)" }}>
          {error}
        </div>
      )}
      <Table
        columns={buildColumns(
          (id) => supplierNames.get(id),
          (id) => warehouseNames.get(id),
        )}
        rows={data}
        rowKey={(po) => String(po.id)}
        isLoading={isLoading}
        emptyMessage="No purchase orders match the current filters."
      />
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={goToPage}
      />
    </>
  );
}
