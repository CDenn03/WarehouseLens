import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { formatNumber, getErrorMessage } from "@/lib/utils";
import { getWarehouses } from "@/features/inventory/services/inventoryService";
import { CreateWarehouseModal } from "@/features/warehouse/components/CreateWarehouseModal";
import { EditWarehouseModal } from "@/features/warehouse/components/EditWarehouseModal";
import { ToggleWarehouseActiveButton } from "@/features/warehouse/components/ToggleWarehouseActiveButton";

export async function WarehousesPage() {
  let warehouses;
  try {
    warehouses = await getWarehouses();
  } catch (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Warehouses"
          description="Manage warehouse locations"
        />
        <ErrorState message={getErrorMessage(error)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Warehouses"
        description={`${formatNumber(warehouses.length)} warehouse${warehouses.length !== 1 ? "s" : ""} registered`}
        actions={<CreateWarehouseModal />}
      />

      {warehouses.length === 0 ? (
        <Card>
          <p
            className="py-8 text-center text-sm"
            style={{ color: "var(--ink-mute)" }}
          >
            No warehouses configured yet.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((warehouse) => (
            <Card key={warehouse.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3
                    className="text-base font-semibold"
                    style={{ color: "var(--ink)" }}
                  >
                    {warehouse.name}
                  </h3>
                  {warehouse.address && (
                    <p
                      className="mt-0.5 text-sm"
                      style={{ color: "var(--ink-soft)" }}
                    >
                      {warehouse.address}
                    </p>
                  )}
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: warehouse.is_active ? "var(--green-050)" : "var(--bg-alt)",
                    color: warehouse.is_active ? "var(--green-900)" : "var(--ink-mute)",
                  }}
                >
                  {warehouse.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div
                className="mt-4 flex items-center justify-end gap-1 border-t pt-3"
                style={{ borderColor: "var(--border-soft)" }}
              >
                <EditWarehouseModal warehouse={warehouse} />
                <ToggleWarehouseActiveButton
                  warehouseId={warehouse.id}
                  warehouseName={warehouse.name}
                  isActive={warehouse.is_active}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
