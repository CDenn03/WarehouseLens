import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { formatNumber, getErrorMessage } from "@/lib/utils";
import { getWarehouses } from "@/features/inventory/services/inventoryService";

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
              <div className="flex items-start justify-between">
                <div>
                  <h3
                    className="text-base font-semibold"
                    style={{ color: "var(--ink)" }}
                  >
                    {warehouse.name}
                  </h3>
                  {warehouse.code && (
                    <p
                      className="mt-0.5 text-sm"
                      style={{ color: "var(--ink-mute)" }}
                    >
                      {warehouse.code}
                    </p>
                  )}
                </div>
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: "var(--green-050)",
                    color: "var(--green-900)",
                  }}
                >
                  Active
                </span>
              </div>
              {warehouse.location && (
                <p
                  className="mt-3 text-sm"
                  style={{ color: "var(--ink-soft)" }}
                >
                  {warehouse.location}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
