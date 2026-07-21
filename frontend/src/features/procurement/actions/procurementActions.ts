"use server";

import { revalidatePath } from "next/cache";
import {
  createPurchaseOrder,
  createSupplier,
  receivePurchaseOrder,
} from "@/features/procurement/services/procurementService";
import type {
  CreatePurchaseOrderInput,
  NewSupplierInput,
} from "@/features/procurement/types";
import { getErrorMessage } from "@/lib/utils";
import type { ActionResult } from "@/lib/utils";

export async function submitNewSupplier(
  input: NewSupplierInput,
): Promise<ActionResult> {
  if (!input.name.trim()) {
    return { ok: false, error: "Supplier name is required." };
  }
  try {
    await createSupplier(input);
    revalidatePath("/procurement");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitNewPurchaseOrder(
  input: CreatePurchaseOrderInput,
): Promise<ActionResult> {
  if (!input.supplier_id) return { ok: false, error: "Pick a supplier." };
  if (!input.destination_warehouse_id) {
    return { ok: false, error: "Pick a destination warehouse." };
  }
  if (input.items.length === 0) {
    return { ok: false, error: "Add at least one line item." };
  }
  if (input.items.some((item) => !item.product_id || item.quantity_ordered <= 0)) {
    return {
      ok: false,
      error: "Every line needs a product and a quantity above zero.",
    };
  }
  try {
    await createPurchaseOrder(input);
    revalidatePath("/procurement");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitReceivePurchaseOrder(
  purchaseOrderId: string,
): Promise<ActionResult> {
  try {
    await receivePurchaseOrder(purchaseOrderId);
    revalidatePath("/procurement");
    revalidatePath("/inventory");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
