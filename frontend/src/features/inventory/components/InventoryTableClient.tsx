"use client";

import Link from "next/link";
import { Card } from "@/components/Card";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";
import { Table } from "@/components/Table";
import type { Column } from "@/components/Table";
import { useTableData } from "@/hooks/useTableData";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/features/inventory/types";
import { NewProductModal } from "@/features/inventory/components/NewProductModal";

const columns: Column<Product>[] = [
  {
    key: "sku",
    header: "SKU",
    render: (product) => (
      <Link
        href={`/inventory/${product.id}`}
        className="font-medium text-brand-900 hover:text-brand-800 hover:underline"
      >
        {product.sku}
      </Link>
    ),
  },
  {
    key: "name",
    header: "Name",
    render: (product) => (
      <Link
        href={`/inventory/${product.id}`}
        className="text-ink hover:underline"
      >
        {product.name}
      </Link>
    ),
  },
  { key: "category", header: "Category", render: (p) => p.category },
  {
    key: "unit_cost",
    header: "Unit cost",
    className: "text-right",
    render: (p) => formatCurrency(p.unit_cost),
  },
];

export function InventoryTableClient() {
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
  } = useTableData<Product>("/products", {
    pageSize: 20,
    defaultSortBy: "created_at",
    defaultSortOrder: "desc",
  });

  return (
    <div className="space-y-6">
      <Card flush>
        <div className="flex items-center gap-4 border-b px-4 py-3" style={{ borderColor: "var(--border-soft)" }}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search products..."
            className="flex-1"
          />
          <NewProductModal />
        </div>
        {error && (
          <div className="px-4 py-3 text-sm" style={{ color: "var(--error)" }}>
            {error}
          </div>
        )}
        <Table
          columns={columns}
          rows={data}
          rowKey={(p) => String(p.id)}
          isLoading={isLoading}
          emptyMessage={
            search
              ? `No products match "${search}".`
              : "No products yet — add your first one."
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
