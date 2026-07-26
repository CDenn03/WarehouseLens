import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { getErrorMessage } from "@/lib/utils";
import { getProducts } from "@/features/inventory/services/inventoryService";
import { InventoryTableClient } from "@/features/inventory/components/InventoryTableClient";

export async function InventoryPage({ search }: { search?: string }) {
  try {
    await getProducts(search);
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
      />
      <InventoryTableClient />
    </div>
  );
}
