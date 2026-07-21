import type { BadgeTone } from "@/components/Badge";

export interface Supplier {
  id: string;
  name: string;
  contact_email?: string | null;
  lead_time_days?: number | null;
}

export interface NewSupplierInput {
  name: string;
  contact_email?: string;
  lead_time_days?: number;
}

export type PurchaseOrderStatus =
  | "pending"
  | "confirmed"
  | "received"
  | "cancelled";

export interface PurchaseOrderItem {
  product_id: string;
  product_name?: string;
  sku?: string;
  quantity_ordered: number;
  quantity_received?: number;
}

export interface PurchaseOrder {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  destination_warehouse_id: string;
  destination_warehouse_name?: string;
  order_date: string;
  expected_delivery_date: string;
  status: PurchaseOrderStatus;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderFilters {
  warehouse_id?: string;
  status?: PurchaseOrderStatus;
}

export interface CreatePurchaseOrderInput {
  supplier_id: string;
  destination_warehouse_id: string;
  order_date: string;
  expected_delivery_date: string;
  items: Array<{ product_id: string; quantity_ordered: number }>;
}

export function purchaseOrderStatusTone(status: PurchaseOrderStatus): BadgeTone {
  switch (status) {
    case "pending":
      return "amber";
    case "confirmed":
      return "blue";
    case "received":
      return "green";
    case "cancelled":
      return "red";
    default:
      return "slate";
  }
}
