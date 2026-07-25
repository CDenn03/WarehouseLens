import { apiFetch } from "@/lib/api";
import type { PlatformAdminRead, TenantCreate, TenantRead } from "@/features/platform/types";

export function listTenants(): Promise<TenantRead[]> {
  return apiFetch<TenantRead[]>("/platform/tenants");
}

export function getTenant(tenantId: string): Promise<TenantRead> {
  return apiFetch<TenantRead>(`/platform/tenants/${tenantId}`);
}

export function createTenant(data: TenantCreate): Promise<TenantRead> {
  return apiFetch<TenantRead>("/platform/tenants", { method: "POST", body: data });
}

export function listPlatformAdmins(): Promise<PlatformAdminRead[]> {
  return apiFetch<PlatformAdminRead[]>("/platform/admins");
}

export function assignPlatformAdmin(userId: string): Promise<void> {
  return apiFetch<void>("/platform/admins", { method: "POST", body: { user_id: userId } });
}

export function revokePlatformAdmin(userId: string): Promise<void> {
  return apiFetch<void>(`/platform/admins/${userId}`, { method: "DELETE" });
}
