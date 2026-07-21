import { Badge } from "@/components/Badge";
import type { BadgeTone } from "@/components/Badge";
import { Table } from "@/components/Table";
import type { Column } from "@/components/Table";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";
import type { InventoryTransaction } from "@/features/inventory/types";

function toneForType(type: string): BadgeTone {
  switch (type) {
    case "receipt":
    case "transfer_in":
      return "green";
    case "issue":
    case "transfer_out":
      return "blue";
    case "adjustment":
      return "amber";
    default:
      return "slate";
  }
}

function buildColumns(
  warehouseName: (id: string) => string | undefined,
): Column<InventoryTransaction>[] {
  return [
  {
    key: "occurred_at",
    header: "When",
    render: (row) => formatDateTime(row.occurred_at),
  },
  {
    key: "warehouse",
    header: "Warehouse",
    render: (row) => warehouseName(String(row.warehouse_id)) ?? row.warehouse_id,
  },
  {
    key: "type",
    header: "Type",
    render: (row) => (
      <Badge tone={toneForType(String(row.type))}>
        {String(row.type).replace(/_/g, " ")}
      </Badge>
    ),
  },
  {
    key: "delta",
    header: "Δ Quantity",
    className: "text-right",
    render: (row) => (
      <span
        className={cn(
          "font-medium tabular-nums",
          row.quantity_delta >= 0 ? "text-emerald-600" : "text-red-600",
        )}
      >
        {row.quantity_delta >= 0 ? "+" : ""}
        {formatNumber(row.quantity_delta)}
      </span>
    ),
  },
  ];
}

export function TransactionsTable({
  rows,
  warehouses = [],
}: {
  rows: InventoryTransaction[];
  warehouses?: Array<{ id: string; name: string }>;
}) {
  const names = new Map(warehouses.map((w) => [String(w.id), w.name]));
  return (
    <Table
      columns={buildColumns((id) => names.get(id))}
      rows={rows}
      rowKey={(row) => String(row.id)}
      emptyMessage="No transactions recorded for this product yet."
    />
  );
}
