import { apiFetch } from "@/lib/api";
import type { Warehouse, WarehouseUpdateInput } from "@/features/inventory/types";

export function createWarehouse(input: {
  name: string;
  address?: string;
}): Promise<Warehouse> {
  return apiFetch<Warehouse>("/warehouses", { method: "POST", body: input });
}

export function updateWarehouse(
  warehouseId: string,
  input: WarehouseUpdateInput,
): Promise<Warehouse> {
  return apiFetch<Warehouse>(`/warehouses/${warehouseId}`, {
    method: "PATCH",
    body: input,
  });
}
