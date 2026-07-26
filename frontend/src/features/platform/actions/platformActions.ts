"use server";

import { revalidatePath } from "next/cache";
import {
  createPlatformAdmin,
  createTenant,
  deleteTenant,
  resetPlatformAdminPassword,
  resetTenantAdminPassword,
  revokePlatformAdmin,
  updatePlatformAdmin,
  updateTenant,
} from "@/features/platform/services/platformService";
import type {
  PasswordResetRead,
  PlatformAdminCreate,
  PlatformAdminUpdate,
  PlatformAdminWithCredentialRead,
  TenantCreate,
  TenantUpdate,
  TenantWithAdminRead,
} from "@/features/platform/types";
import { getErrorMessage } from "@/lib/utils";
import type { ActionResult, ActionResultWith } from "@/lib/utils";

/** Every platform surface renders the same data — refresh all three. */
function revalidatePlatform(): void {
  revalidatePath("/platform");
  revalidatePath("/platform/tenants");
  revalidatePath("/platform/admins");
}

async function run<T>(fn: () => Promise<T>): Promise<ActionResultWith<T>> {
  try {
    const data = await fn();
    revalidatePlatform();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

// ── Tenants ────────────────────────────────────────────────────────────────

export async function submitCreateTenant(
  data: TenantCreate,
): Promise<ActionResultWith<TenantWithAdminRead>> {
  if (!data.name.trim()) return { ok: false, error: "Tenant name is required." };
  if (!data.admin_email.trim())
    return { ok: false, error: "Admin email is required." };
  return run(() => createTenant(data));
}

export async function submitUpdateTenant(
  tenantId: string,
  data: TenantUpdate,
): Promise<ActionResultWith<TenantWithAdminRead>> {
  if (data.name !== undefined && !data.name.trim())
    return { ok: false, error: "Tenant name cannot be empty." };
  if (data.name === undefined && data.admin_email === undefined)
    return { ok: false, error: "Nothing to update." };
  return run(() => updateTenant(tenantId, data));
}

export async function submitDeleteTenant(
  tenantId: string,
): Promise<ActionResult> {
  const result = await run(() => deleteTenant(tenantId));
  return result.ok ? { ok: true } : result;
}

export async function submitResetTenantAdminPassword(
  tenantId: string,
): Promise<ActionResultWith<PasswordResetRead>> {
  return run(() => resetTenantAdminPassword(tenantId));
}

// ── Platform admins ────────────────────────────────────────────────────────

export async function submitCreatePlatformAdmin(
  data: PlatformAdminCreate,
): Promise<ActionResultWith<PlatformAdminWithCredentialRead>> {
  if (!data.email?.trim() && !data.user_id?.trim())
    return { ok: false, error: "Provide an email address or a user ID." };
  return run(() => createPlatformAdmin(data));
}

export async function submitUpdatePlatformAdmin(
  userId: string,
  data: PlatformAdminUpdate,
): Promise<ActionResult> {
  if (data.email === undefined && data.username === undefined)
    return { ok: false, error: "Nothing to update." };
  const result = await run(() => updatePlatformAdmin(userId, data));
  return result.ok ? { ok: true } : result;
}

export async function submitResetPlatformAdminPassword(
  userId: string,
): Promise<ActionResultWith<PasswordResetRead>> {
  return run(() => resetPlatformAdminPassword(userId));
}

export async function submitRevokePlatformAdmin(
  userId: string,
): Promise<ActionResult> {
  const result = await run(() => revokePlatformAdmin(userId));
  return result.ok ? { ok: true } : result;
}
