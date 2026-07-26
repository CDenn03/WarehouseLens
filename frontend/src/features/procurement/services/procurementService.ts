import { apiFetch } from "@/lib/api";
import type {
  CreatePurchaseOrderInput,
  NewSupplierInput,
  PurchaseOrder,
  PurchaseOrderFilters,
  Supplier,
} from "@/features/procurement/types";

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export function getSuppliers(): Promise<Supplier[]> {
  return apiFetch<Supplier[]>("/suppliers");
}

export function createSupplier(input: NewSupplierInput): Promise<Supplier> {
  return apiFetch<Supplier>("/suppliers", { method: "POST", body: input });
}

export function getPurchaseOrders(
  filters: PurchaseOrderFilters = {},
  params?: Record<string, string | number>,
): Promise<PaginatedResponse<PurchaseOrder>> {
  return apiFetch<PaginatedResponse<PurchaseOrder>>("/purchase-orders", {
    query: { ...filters, ...params },
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
