"use server";

import { revalidatePath } from "next/cache";
import {
  assignRole,
  assignWarehouse,
  revokeRole,
  revokeWarehouse,
} from "@/features/admin/services/adminService";
import { getErrorMessage } from "@/lib/utils";
import type { ActionResult } from "@/lib/utils";

// ── Role actions ───────────────────────────────────────────────────────────

export async function submitAssignRole(
  userId: string,
  roleSlug: string,
): Promise<ActionResult> {
  if (!roleSlug) return { ok: false, error: "Select a role to assign." };
  try {
    await assignRole(userId, roleSlug);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitRevokeRole(
  userId: string,
  roleSlug: string,
): Promise<ActionResult> {
  try {
    await revokeRole(userId, roleSlug);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

// ── Warehouse actions ──────────────────────────────────────────────────────

export async function submitAssignWarehouse(
  userId: string,
  warehouseId: string,
): Promise<ActionResult> {
  if (!warehouseId)
    return { ok: false, error: "Select a warehouse to assign." };
  try {
    await assignWarehouse(userId, warehouseId);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitRevokeWarehouse(
  userId: string,
  warehouseId: string,
): Promise<ActionResult> {
  try {
    await revokeWarehouse(userId, warehouseId);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
