"use client";

import { Card } from "@/components/Card";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { Table } from "@/components/Table";
import type { Column } from "@/components/Table";
import { useTableData } from "@/hooks/useTableData";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { TenantRowActions } from "@/features/platform/components/TenantRowActions";
import { TenantFormModal } from "@/features/platform/components/TenantFormModal";
import type { TenantRead } from "@/features/platform/types";

const columns: Column<TenantRead>[] = [
  { key: "name", header: "Name", render: (t) => t.name },
  {
    key: "admin_email",
    header: "Admin email",
    render: (t) => t.admin_email ?? <span className="italic">not set</span>,
  },
  {
    key: "user_count",
    header: "Users",
    className: "text-right",
    render: (t) => formatNumber(t.user_count),
  },
  {
    key: "warehouse_count",
    header: "Warehouses",
    className: "text-right",
    render: (t) => formatNumber(t.warehouse_count),
  },
  {
    key: "created_at",
    header: "Created",
    render: (t) => formatDateTime(t.created_at),
  },
  {
    key: "actions",
    header: "Actions",
    className: "text-right",
    render: (t) => <TenantRowActions tenant={t} />,
  },
];

export function TenantsTableClient() {
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
  } = useTableData<TenantRead>("/platform/tenants", {
    pageSize: 20,
    defaultSortBy: "created_at",
    defaultSortOrder: "desc",
  });

  return (
    <div className="space-y-6">
      <Card flush>
        <div
          className="flex items-center gap-4 border-b px-4 py-3"
          style={{ borderColor: "var(--border-soft)" }}
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search tenants..."
            className="flex-1"
          />
          <TenantFormModal />
        </div>
        {error && (
          <div className="px-4 py-3 text-sm" style={{ color: "var(--error)" }}>
            {error}
          </div>
        )}
        <Table
          columns={columns}
          rows={data}
          rowKey={(t) => String(t.id)}
          isLoading={isLoading}
          emptyMessage={
            search
              ? `No tenants match "${search}".`
              : "No tenants yet — create the first one."
          }
        />
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={goToPage}
        />
      </Card>
    </div>
  );
}
