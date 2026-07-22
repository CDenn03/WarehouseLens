import type { BadgeTone } from "@/components/Badge";

export type OutboundStatus =
  | "requested"
  | "picking"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PickListStatus = "open" | "in_progress" | "complete";

export interface OutboundRequest {
  id: string;
  status: OutboundStatus;
  /** Set for sales-order-driven requests; null for internal transfers. */
  sales_order_id?: string | null;
  source_warehouse_id: string;
  source_warehouse_name?: string;
  /** Set for internal transfers; null means external destination. */
  destination_warehouse_id?: string | null;
  destination_warehouse_name?: string | null;
  created_at?: string;
}

export interface OutboundItem {
  product_id: string;
  product_name?: string;
  sku?: string;
  quantity_requested: number;
}

export interface PickListItem {
  product_id: string;
  product_name?: string;
  sku?: string;
  quantity_requested: number;
  quantity_picked: number;
  location?: string | null;
}

export interface PickList {
  id: string;
  status: PickListStatus;
  items: PickListItem[];
}

export interface Shipment {
  id: string;
  carrier: string | null;
  tracking_number: string | null;
  status?: string;
  shipped_at?: string | null;
  delivered_at?: string | null;
}

/** GET /outbound-requests/{id} — request with items, pick lists and shipments. */
export interface OutboundRequestDetail extends OutboundRequest {
  items: OutboundItem[];
  pick_lists: PickList[];
  shipments: Shipment[];
}

export interface OutboundFilters {
  warehouse_id?: string;
  status?: OutboundStatus;
}

export interface OrderItemInput {
  product_id: string;
  quantity_ordered: number;
}

/** POST /sales-orders — auto-generates a linked outbound request. */
export interface CreateSalesOrderInput {
  source_warehouse_id: string;
  customer_name: string;
  items: OrderItemInput[];
}

export interface TransferItemInput {
  product_id: string;
  quantity_requested: number;
}

/** POST /outbound-requests — internal warehouse-to-warehouse transfers only. */
export interface CreateInternalTransferInput {
  source_warehouse_id: string;
  destination_warehouse_id: string;
  items: TransferItemInput[];
}

export interface UpdatePickListItemInput {
  quantity_picked: number;
  location?: string;
}

export interface ShipOutboundInput {
  carrier: string;
  tracking_number: string;
}

export function outboundStatusTone(status: OutboundStatus): BadgeTone {
  switch (status) {
    case "requested":
      return "slate";
    case "picking":
      return "amber";
    case "packed":
      return "brand";
    case "shipped":
      return "blue";
    case "delivered":
      return "green";
    case "cancelled":
      return "red";
    default:
      return "slate";
  }
}

export function pickListStatusTone(status: PickListStatus): BadgeTone {
  switch (status) {
    case "open":
      return "slate";
    case "in_progress":
      return "amber";
    case "complete":
      return "green";
    default:
      return "slate";
  }
}
