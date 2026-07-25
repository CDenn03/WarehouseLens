"use server";

import { revalidatePath } from "next/cache";
import { createTenant, revokePlatformAdmin } from "@/features/platform/services/platformService";
import type { TenantCreate } from "@/features/platform/types";
import { getErrorMessage } from "@/lib/utils";
import type { ActionResult } from "@/lib/utils";

export async function submitCreateTenant(data: TenantCreate): Promise<ActionResult> {
  if (!data.name.trim()) return { ok: false, error: "Tenant name is required." };
  try {
    await createTenant(data);
    revalidatePath("/platform");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function submitRevokePlatformAdmin(userId: string): Promise<ActionResult> {
  try {
    await revokePlatformAdmin(userId);
    revalidatePath("/platform");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
