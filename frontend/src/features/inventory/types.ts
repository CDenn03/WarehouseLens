/** Inventory feature types. Also owns `Warehouse`, which other features import. */

export interface Warehouse {
  id: string;
  name: string;
  code?: string;
  location?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit_cost: number;
}

export interface NewProductInput {
  sku: string;
  name: string;
  category: string;
  unit_cost: number;
}

/** Per-warehouse stock breakdown row (GET /products/{id}/stock → .stock[]). */
export interface ProductStock {
  warehouse_id: string;
  warehouse_name: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  reorder_point: number;
  below_reorder_point?: boolean;
}

/** Full response shape of GET /products/{id}/stock. */
export interface ProductStockBreakdown {
  product: Product;
  stock: ProductStock[];
}

export type TransactionType =
  | "receipt"
  | "issue"
  | "adjustment"
  | "transfer_in"
  | "transfer_out";

export interface InventoryTransaction {
  id: string;
  warehouse_id: string;
  warehouse_name?: string;
  product_id: string;
  product_name?: string;
  quantity_delta: number;
  type: TransactionType | string;
  occurred_at?: string;
}

export interface TransactionFilters {
  warehouse_id?: string;
  product_id?: string;
  date_from?: string;
  date_to?: string;
}

/** Manual stock adjustment (POST /inventory/transactions). */
export interface ManualAdjustmentInput {
  warehouse_id: string;
  product_id: string;
  quantity_delta: number;
  type: TransactionType;
}

export interface ForecastPoint {
  date: string;
  yhat: number;
  yhat_lower: number;
  yhat_upper: number;
}

export interface Forecast {
  product_id: string;
  warehouse_id: string | null;
  horizon_days: number;
  points: ForecastPoint[];
  model: string;
}
