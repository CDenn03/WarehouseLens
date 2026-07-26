"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { Table } from "@/components/Table";
import type { Column } from "@/components/Table";
import type { PermissionRead } from "@/features/admin/types";

interface Props {
  initialPermissions: PermissionRead[];
}

const CATEGORY_LABELS: Record<string, string> = {
  agent: "Agent",
  dashboard: "Dashboard",
  forecast: "Forecast",
  iam: "IAM",
  inventory: "Inventory",
  outbound: "Outbound",
  platform: "Platform",
  procurement: "Procurement",
  warehouse: "Warehouse",
};

export function PermissionsPageClient({ initialPermissions }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = initialPermissions.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.id.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const columns: Column<PermissionRead>[] = [
    {
      key: "id",
      header: "Permission",
      render: (p) => (
        <span className="font-mono text-xs" style={{ color: "var(--ink)" }}>
          {p.id}
        </span>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (p) => (
        <span style={{ color: "var(--ink-soft)" }}>{p.description}</span>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (p) => (
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
          style={{
            background: "var(--green-050)",
            color: "var(--green-900)",
          }}
        >
          {CATEGORY_LABELS[p.category] ?? p.category}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Permissions"
        description="All permissions available in the system"
      />

      <Card flush>
        <div
          className="flex items-center gap-4 border-b px-4 py-3"
          style={{ borderColor: "var(--border-soft)" }}
        >
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1); }}
            placeholder="Search permissions..."
            className="flex-1"
          />
        </div>
        <Table
          columns={columns}
          rows={paginated}
          rowKey={(p) => p.id}
          emptyMessage={
            search ? `No permissions match "${search}".` : "No permissions found."
          }
        />
        <Pagination
          page={safePage}
          totalPages={totalPages}
          total={filtered.length}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </Card>
    </div>
  );
}
