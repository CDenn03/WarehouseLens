import Link from "next/link";
import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { Table } from "@/components/Table";
import type { Column } from "@/components/Table";
import { formatCurrency, getErrorMessage } from "@/lib/utils";
import { getProducts } from "@/features/inventory/services/inventoryService";
import type { Product } from "@/features/inventory/types";
import { ProductSearch } from "@/features/inventory/components/ProductSearch";
import { NewProductModal } from "@/features/inventory/components/NewProductModal";

const columns: Column<Product>[] = [
  {
    key: "sku",
    header: "SKU",
    render: (product) => (
      <Link
        href={`/inventory/${product.id}`}
        className="font-medium text-indigo-600 hover:text-indigo-500 hover:underline"
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
        className="text-slate-900 hover:underline"
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

export async function InventoryPage({ search }: { search?: string }) {
  let products: Product[];
  try {
    products = await getProducts(search);
  } catch (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Inventory" description="Product catalog and stock levels" />
        <ErrorState message={getErrorMessage(error)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Product catalog and stock levels across warehouses"
        actions={<NewProductModal />}
      />
      <Card flush>
        <div className="border-b border-slate-100 p-4">
          <ProductSearch initialValue={search ?? ""} />
        </div>
        <Table
          columns={columns}
          rows={products}
          rowKey={(p) => String(p.id)}
          emptyMessage={
            search
              ? `No products match "${search}".`
              : "No products yet — add your first one."
          }
        />
      </Card>
    </div>
  );
}
