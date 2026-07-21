"use server";

import { revalidatePath } from "next/cache";
import {
  completePickList,
  createInternalTransfer,
  createPickList,
  createSalesOrder,
  deliverShipment,
  shipOutboundRequest,
  updatePickListItem,
} from "@/features/outbound/services/outboundService";
import type {
  CreateInternalTransferInput,
  CreateSalesOrderInput,
  ShipOutboundInput,
  UpdatePickListItemInput,
} from "@/features/outbound/types";
import { getErrorMessage } from "@/lib/utils";
import type { ActionResult } from "@/lib/utils";

function validateItems(
  items: Array<{ product_id: string; quantity_ordered?: number; quantity_requested?: number }>,
): string | null {
  if (items.length === 0) return "Add at least one line item.";
  const invalid = items.some(
    (item) =>
      !item.product_id || (item.quantity_ordered ?? item.quantity_requested ?? 0) <= 0,
  );
  if (invalid) {
    return "Every line needs a product and a quantity above zero.";
  }
  return null;
}

function revalidateOutbound(requestId?: string) {
  revalidatePath("/outbound");
  if (requestId) revalidatePath(`/outbound/${requestId}`);
  revalidatePath("/");
}

export async function submitSalesOrder(
  input: CreateSalesOrderInput,
): Promise<ActionResult> {
  if (!input.source_warehouse_id) {
    return { ok: false, error: "Pick a source warehouse." };
  }
  if (!input.customer_name.trim()) {
    return { ok: false, error: "Customer name is required." };
  }
  const itemsError = validateItems(input.items);
  if (itemsError) return { ok: false, error: itemsError };
  try {
    await createSalesOrder(input);
    revalidateOutbound();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitInternalTransfer(
  input: CreateInternalTransferInput,
): Promise<ActionResult> {
  if (!input.source_warehouse_id || !input.destination_warehouse_id) {
    return { ok: false, error: "Pick both a source and a destination warehouse." };
  }
  if (input.source_warehouse_id === input.destination_warehouse_id) {
    return { ok: false, error: "Source and destination must be different warehouses." };
  }
  const itemsError = validateItems(input.items);
  if (itemsError) return { ok: false, error: itemsError };
  try {
    await createInternalTransfer(input);
    revalidateOutbound();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitCreatePickList(
  requestId: string,
): Promise<ActionResult> {
  try {
    await createPickList(requestId);
    revalidateOutbound(requestId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitPickListItem(
  requestId: string,
  pickListId: string,
  productId: string,
  input: UpdatePickListItemInput,
): Promise<ActionResult> {
  if (!Number.isFinite(input.quantity_picked) || input.quantity_picked < 0) {
    return { ok: false, error: "Picked quantity must be zero or more." };
  }
  try {
    await updatePickListItem(pickListId, productId, input);
    revalidateOutbound(requestId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitCompletePickList(
  requestId: string,
  pickListId: string,
): Promise<ActionResult> {
  try {
    await completePickList(pickListId);
    revalidateOutbound(requestId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitShipRequest(
  requestId: string,
  input: ShipOutboundInput,
): Promise<ActionResult> {
  if (!input.carrier.trim() || !input.tracking_number.trim()) {
    return { ok: false, error: "Carrier and tracking number are both required." };
  }
  try {
    await shipOutboundRequest(requestId, input);
    revalidateOutbound(requestId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitDeliverShipment(
  requestId: string,
  shipmentId: string,
): Promise<ActionResult> {
  try {
    await deliverShipment(shipmentId);
    revalidateOutbound(requestId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
