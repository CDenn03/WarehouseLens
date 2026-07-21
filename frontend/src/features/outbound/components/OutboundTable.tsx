import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Table } from "@/components/Table";
import type { Column } from "@/components/Table";
import { formatDateTime } from "@/lib/utils";
import type { OutboundRequest } from "@/features/outbound/types";
import { outboundStatusTone } from "@/features/outbound/types";

// The API returns warehouse IDs, not names — callers pass a lookup built from
// the warehouses list they already fetch, so the table shows readable names.
function buildColumns(
  warehouseName: (id?: string | null) => string | undefined,
): Column<OutboundRequest>[] {
  return [
    {
      key: "id",
      header: "Request",
      render: (request) => (
        <Link
          href={`/outbound/${request.id}`}
          className="font-medium text-indigo-600 hover:text-indigo-500 hover:underline"
        >
          #{String(request.id).slice(0, 8)}
        </Link>
      ),
    },
    {
      key: "kind",
      header: "Type",
      render: (request) =>
        request.destination_warehouse_id ? (
          <Badge tone="blue">Internal transfer</Badge>
        ) : (
          <Badge tone="indigo">Sales order</Badge>
        ),
    },
    {
      key: "source",
      header: "Source",
      render: (request) =>
        warehouseName(request.source_warehouse_id) ?? request.source_warehouse_id,
    },
    {
      key: "destination",
      header: "Destination",
      render: (request) =>
        warehouseName(request.destination_warehouse_id) ?? "External customer",
    },
    {
      key: "status",
      header: "Status",
      render: (request) => (
        <Badge tone={outboundStatusTone(request.status)}>{request.status}</Badge>
      ),
    },
    {
      key: "created_at",
      header: "Created",
      render: (request) => formatDateTime(request.created_at),
    },
  ];
}

export function OutboundTable({
  requests,
  warehouses = [],
}: {
  requests: OutboundRequest[];
  warehouses?: Array<{ id: string; name: string }>;
}) {
  const names = new Map(warehouses.map((w) => [String(w.id), w.name]));
  const warehouseName = (id?: string | null) =>
    id ? names.get(String(id)) : undefined;
  return (
    <Table
      columns={buildColumns(warehouseName)}
      rows={requests}
      rowKey={(request) => String(request.id)}
      emptyMessage="No outbound requests match the current filters."
    />
  );
}
