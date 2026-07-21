import { Badge } from "@/components/Badge";
import { Table } from "@/components/Table";
import type { Column } from "@/components/Table";
import { formatNumber } from "@/lib/utils";
import type { ProductStock } from "@/features/inventory/types";

const columns: Column<ProductStock>[] = [
  {
    key: "warehouse",
    header: "Warehouse",
    render: (row) => (
      <span className="font-medium text-slate-900">{row.warehouse_name}</span>
    ),
  },
  {
    key: "on_hand",
    header: "On hand",
    className: "text-right",
    render: (row) => formatNumber(row.quantity_on_hand),
  },
  {
    key: "reserved",
    header: "Reserved",
    className: "text-right",
    render: (row) => formatNumber(row.quantity_reserved),
  },
  {
    key: "available",
    header: "Available",
    className: "text-right",
    render: (row) =>
      formatNumber(row.quantity_on_hand - row.quantity_reserved),
  },
  {
    key: "reorder_point",
    header: "Reorder point",
    className: "text-right",
    render: (row) => formatNumber(row.reorder_point),
  },
  {
    key: "status",
    header: "Status",
    render: (row) =>
      row.quantity_on_hand < row.reorder_point ? (
        <Badge tone="red">Below reorder point</Badge>
      ) : (
        <Badge tone="green">OK</Badge>
      ),
  },
];

export function StockBreakdownTable({ rows }: { rows: ProductStock[] }) {
  return (
    <Table
      columns={columns}
      rows={rows}
      rowKey={(row) => String(row.warehouse_id)}
      emptyMessage="No stock records for this product yet."
      rowClassName={(row) =>
        row.quantity_on_hand < row.reorder_point ? "bg-red-50/60" : undefined
      }
    />
  );
}
