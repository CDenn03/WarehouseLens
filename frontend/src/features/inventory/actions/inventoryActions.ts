"use server";

import { revalidatePath } from "next/cache";
import {
  createProduct,
  createTransaction,
} from "@/features/inventory/services/inventoryService";
import type {
  ManualAdjustmentInput,
  NewProductInput,
} from "@/features/inventory/types";
import { getErrorMessage } from "@/lib/utils";
import type { ActionResult } from "@/lib/utils";

export async function submitManualAdjustment(
  input: ManualAdjustmentInput,
): Promise<ActionResult> {
  if (!input.warehouse_id) return { ok: false, error: "Pick a warehouse." };
  if (!Number.isFinite(input.quantity_delta) || input.quantity_delta === 0) {
    return { ok: false, error: "Quantity delta must be a non-zero number." };
  }
  try {
    await createTransaction(input);
    revalidatePath(`/inventory/${input.product_id}`);
    revalidatePath("/inventory");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitNewProduct(
  input: NewProductInput,
): Promise<ActionResult> {
  if (!input.sku.trim() || !input.name.trim()) {
    return { ok: false, error: "SKU and name are required." };
  }
  if (!Number.isFinite(input.unit_cost) || input.unit_cost < 0) {
    return { ok: false, error: "Unit cost must be a non-negative number." };
  }
  try {
    await createProduct(input);
    revalidatePath("/inventory");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
