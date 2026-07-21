import { apiFetch } from "@/lib/api";
import type {
  CreatePurchaseOrderInput,
  NewSupplierInput,
  PurchaseOrder,
  PurchaseOrderFilters,
  Supplier,
} from "@/features/procurement/types";

export function getSuppliers(): Promise<Supplier[]> {
  return apiFetch<Supplier[]>("/suppliers");
}

export function createSupplier(input: NewSupplierInput): Promise<Supplier> {
  return apiFetch<Supplier>("/suppliers", { method: "POST", body: input });
}

export function getPurchaseOrders(
  filters: PurchaseOrderFilters = {},
): Promise<PurchaseOrder[]> {
  return apiFetch<PurchaseOrder[]>("/purchase-orders", {
    query: { ...filters },
  });
}

export function createPurchaseOrder(
  input: CreatePurchaseOrderInput,
): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>("/purchase-orders", {
    method: "POST",
    body: input,
  });
}

export function receivePurchaseOrder(
  purchaseOrderId: string,
): Promise<PurchaseOrder> {
  return apiFetch<PurchaseOrder>(`/purchase-orders/${purchaseOrderId}/receive`, {
    method: "POST",
  });
}
