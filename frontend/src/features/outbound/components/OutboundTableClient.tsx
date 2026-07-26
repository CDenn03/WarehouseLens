"use client";

import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { Table } from "@/components/Table";
import type { Column } from "@/components/Table";
import { useTableData } from "@/hooks/useTableData";
import { formatDateTime } from "@/lib/utils";
import type { OutboundRequest } from "@/features/outbound/types";
import { outboundStatusTone } from "@/features/outbound/types";

interface LookupTable {
  id: string;
  name: string;
}

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
          className="font-medium text-brand-900 hover:text-brand-800 hover:underline"
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
          <Badge tone="brand">Sales order</Badge>
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

export function OutboundTableClient({
  warehouses = [],
  warehouseId,
  status,
}: {
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
  } = useTableData<OutboundRequest>("/outbound-requests", {
    pageSize: 20,
    defaultSortBy: "created_at",
    defaultSortOrder: "desc",
  });

  const names = new Map(warehouses.map((w) => [String(w.id), w.name]));
  const warehouseName = (id?: string | null) =>
    id ? names.get(String(id)) : undefined;

  return (
    <>
      <div className="flex items-center gap-4 border-b px-4 py-3" style={{ borderColor: "var(--border-soft)" }}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search outbound requests..."
          className="flex-1"
        />
      </div>
      {error && (
        <div className="px-4 py-3 text-sm" style={{ color: "var(--error)" }}>
          {error}
        </div>
      )}
      <Table
        columns={buildColumns(warehouseName)}
        rows={data}
        rowKey={(request) => String(request.id)}
        isLoading={isLoading}
        emptyMessage="No outbound requests match the current filters."
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
