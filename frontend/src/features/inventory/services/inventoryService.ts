import { apiFetch } from "@/lib/api";
import type {
  Forecast,
  InventoryTransaction,
  ManualAdjustmentInput,
  NewProductInput,
  Product,
  ProductStock,
  ProductStockBreakdown,
  TransactionFilters,
  Warehouse,
} from "@/features/inventory/types";

export function getWarehouses(): Promise<Warehouse[]> {
  return apiFetch<Warehouse[]>("/warehouses");
}

export function getProducts(search?: string): Promise<Product[]> {
  return apiFetch<Product[]>("/products", { query: { search } });
}

/**
 * The backend exposes no GET /products/{id}; fetch the list and pick the one
 * we need. Fine at catalog scale; swap for a dedicated endpoint if one appears.
 */
export async function getProduct(productId: string): Promise<Product | null> {
  const products = await getProducts();
  return products.find((p) => String(p.id) === String(productId)) ?? null;
}

export function createProduct(input: NewProductInput): Promise<Product> {
  return apiFetch<Product>("/products", { method: "POST", body: input });
}

export async function getProductStock(productId: string): Promise<ProductStock[]> {
  // the endpoint wraps rows in { product, stock } — callers want the rows
  const breakdown = await apiFetch<ProductStockBreakdown>(`/products/${productId}/stock`);
  return breakdown.stock;
}

export function getTransactions(
  filters: TransactionFilters = {},
): Promise<InventoryTransaction[]> {
  return apiFetch<InventoryTransaction[]>("/inventory/transactions", {
    query: { ...filters },
  });
}

export function createTransaction(
  input: ManualAdjustmentInput,
): Promise<InventoryTransaction> {
  return apiFetch<InventoryTransaction>("/inventory/transactions", {
    method: "POST",
    body: input,
  });
}

export function getForecast(
  productId: string,
  options: { warehouseId?: string; horizon?: number } = {},
): Promise<Forecast> {
  return apiFetch<Forecast>(`/forecast/${productId}`, {
    query: {
      warehouse_id: options.warehouseId,
      horizon: options.horizon ?? 30,
    },
  });
}
