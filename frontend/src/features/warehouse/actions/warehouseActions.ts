"use server";

import { revalidatePath } from "next/cache";
import {
  createWarehouse,
  updateWarehouse,
} from "@/features/warehouse/services/warehouseService";
import { getErrorMessage } from "@/lib/utils";
import type { ActionResult } from "@/lib/utils";

export async function submitCreateWarehouse(input: {
  name: string;
  address?: string;
}): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "Name is required." };
  try {
    await createWarehouse(input);
    revalidatePath("/warehouses");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitUpdateWarehouse(
  warehouseId: string,
  input: { name: string; address?: string },
): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: "Name is required." };
  try {
    await updateWarehouse(warehouseId, input);
    revalidatePath("/warehouses");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitSetWarehouseActive(
  warehouseId: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    await updateWarehouse(warehouseId, { is_active: isActive });
    revalidatePath("/warehouses");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
