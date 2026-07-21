import { apiFetch } from "@/lib/api";
import type {
  CreateInternalTransferInput,
  CreateSalesOrderInput,
  OutboundFilters,
  OutboundRequest,
  OutboundRequestDetail,
  PickList,
  Shipment,
  ShipOutboundInput,
  UpdatePickListItemInput,
} from "@/features/outbound/types";

export function getOutboundRequests(
  filters: OutboundFilters = {},
): Promise<OutboundRequest[]> {
  return apiFetch<OutboundRequest[]>("/outbound-requests", {
    query: { ...filters },
  });
}

export function getOutboundRequest(
  requestId: string,
): Promise<OutboundRequestDetail> {
  return apiFetch<OutboundRequestDetail>(`/outbound-requests/${requestId}`);
}

/** Creating a sales order auto-generates a linked outbound request. */
export function createSalesOrder(
  input: CreateSalesOrderInput,
): Promise<unknown> {
  return apiFetch<unknown>("/sales-orders", { method: "POST", body: input });
}

export function createInternalTransfer(
  input: CreateInternalTransferInput,
): Promise<OutboundRequest> {
  return apiFetch<OutboundRequest>("/outbound-requests", {
    method: "POST",
    body: input,
  });
}

export function createPickList(requestId: string): Promise<PickList> {
  return apiFetch<PickList>(`/outbound-requests/${requestId}/pick-lists`, {
    method: "POST",
  });
}

export function updatePickListItem(
  pickListId: string,
  productId: string,
  input: UpdatePickListItemInput,
): Promise<unknown> {
  return apiFetch<unknown>(`/pick-lists/${pickListId}/items/${productId}`, {
    method: "PATCH",
    body: input,
  });
}

export function completePickList(pickListId: string): Promise<PickList> {
  return apiFetch<PickList>(`/pick-lists/${pickListId}/complete`, {
    method: "POST",
  });
}

export function shipOutboundRequest(
  requestId: string,
  input: ShipOutboundInput,
): Promise<Shipment> {
  return apiFetch<Shipment>(`/outbound-requests/${requestId}/ship`, {
    method: "POST",
    body: input,
  });
}

export function deliverShipment(shipmentId: string): Promise<Shipment> {
  return apiFetch<Shipment>(`/shipments/${shipmentId}/deliver`, {
    method: "PATCH",
  });
}
