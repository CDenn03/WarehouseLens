"use server";

import { revalidatePath } from "next/cache";
import {
  assignRole,
  assignWarehouse,
  revokeRole,
  revokeWarehouse,
  createRole as svcCreateRole,
  updateRole as svcUpdateRole,
  deleteRole as svcDeleteRole,
  createUser as svcCreateUser,
  updateUser as svcUpdateUser,
  deleteUser as svcDeleteUser,
} from "@/features/admin/services/adminService";
import { getErrorMessage } from "@/lib/utils";
import type { ActionResult } from "@/lib/utils";

// ── Role CRUD ───────────────────────────────────────────────────────────

export async function submitCreateRole(
  name: string,
  slug?: string,
  permissionIds?: string[],
): Promise<ActionResult> {
  if (!name.trim()) return { ok: false, error: "Role name is required." };
  try {
    await svcCreateRole(name, slug, permissionIds);
    revalidatePath("/admin/roles");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitUpdateRole(
  roleId: string,
  name: string,
  permissionIds?: string[],
): Promise<ActionResult> {
  if (!name.trim()) return { ok: false, error: "Role name is required." };
  try {
    await svcUpdateRole(roleId, { name, permissionIds });
    revalidatePath("/admin/roles");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitDeleteRole(roleId: string): Promise<ActionResult> {
  try {
    await svcDeleteRole(roleId);
    revalidatePath("/admin/roles");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

// ── User CRUD ───────────────────────────────────────────────────────────

export async function submitCreateUser(
  email: string,
  username?: string,
): Promise<ActionResult> {
  if (!email.trim()) return { ok: false, error: "Email is required." };
  try {
    await svcCreateUser(email, username);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitUpdateUser(
  userId: string,
  data: { email?: string; username?: string },
): Promise<ActionResult> {
  try {
    await svcUpdateUser(userId, data);
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitDeleteUser(userId: string): Promise<ActionResult> {
  try {
    await svcDeleteUser(userId);
    revalidatePath("/admin/users");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

// ── Role assignment ─────────────────────────────────────────────────────

export async function submitAssignRole(
  userId: string,
  roleSlug: string,
): Promise<ActionResult> {
  if (!roleSlug) return { ok: false, error: "Select a role to assign." };
  try {
    await assignRole(userId, roleSlug);
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
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
    revalidatePath(`/admin/users/${userId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

// ── Warehouse assignment ────────────────────────────────────────────────

export async function submitAssignWarehouse(
  userId: string,
  warehouseId: string,
): Promise<ActionResult> {
  if (!warehouseId)
    return { ok: false, error: "Select a warehouse to assign." };
  try {
    await assignWarehouse(userId, warehouseId);
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
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
    revalidatePath(`/admin/users/${userId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
