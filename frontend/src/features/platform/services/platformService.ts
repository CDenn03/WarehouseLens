import { apiFetch } from "@/lib/api";
import type {
  PasswordResetRead,
  PlatformAdminCreate,
  PlatformAdminRead,
  PlatformAdminUpdate,
  PlatformAdminWithCredentialRead,
  TenantCreate,
  TenantRead,
  TenantUpdate,
  TenantWithAdminRead,
} from "@/features/platform/types";

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ── Tenants ────────────────────────────────────────────────────────────────

export function listTenants(
  params?: Record<string, string | number>,
): Promise<PaginatedResponse<TenantRead>> {
  return apiFetch<PaginatedResponse<TenantRead>>("/platform/tenants", {
    query: params,
  });
}

export function getTenant(tenantId: string): Promise<TenantRead> {
  return apiFetch<TenantRead>(`/platform/tenants/${tenantId}`);
}

export function createTenant(data: TenantCreate): Promise<TenantWithAdminRead> {
  return apiFetch<TenantWithAdminRead>("/platform/tenants", {
    method: "POST",
    body: data,
  });
}

export function updateTenant(
  tenantId: string,
  data: TenantUpdate,
): Promise<TenantWithAdminRead> {
  return apiFetch<TenantWithAdminRead>(`/platform/tenants/${tenantId}`, {
    method: "PATCH",
    body: data,
  });
}

export function deleteTenant(tenantId: string): Promise<void> {
  return apiFetch<void>(`/platform/tenants/${tenantId}`, { method: "DELETE" });
}

export function resetTenantAdminPassword(
  tenantId: string,
): Promise<PasswordResetRead> {
  return apiFetch<PasswordResetRead>(
    `/platform/tenants/${tenantId}/admin/reset-password`,
    { method: "POST" },
  );
}

// ── Platform admins ────────────────────────────────────────────────────────

export function listPlatformAdmins(
  params?: Record<string, string | number>,
): Promise<PaginatedResponse<PlatformAdminRead>> {
  return apiFetch<PaginatedResponse<PlatformAdminRead>>("/platform/admins", {
    query: params,
  });
}

export function createPlatformAdmin(
  data: PlatformAdminCreate,
): Promise<PlatformAdminWithCredentialRead> {
  return apiFetch<PlatformAdminWithCredentialRead>("/platform/admins", {
    method: "POST",
    body: data,
  });
}

export function updatePlatformAdmin(
  userId: string,
  data: PlatformAdminUpdate,
): Promise<PlatformAdminRead> {
  return apiFetch<PlatformAdminRead>(`/platform/admins/${userId}`, {
    method: "PATCH",
    body: data,
  });
}

export function resetPlatformAdminPassword(
  userId: string,
): Promise<PasswordResetRead> {
  return apiFetch<PasswordResetRead>(
    `/platform/admins/${userId}/reset-password`,
    { method: "POST" },
  );
}

export function revokePlatformAdmin(userId: string): Promise<void> {
  return apiFetch<void>(`/platform/admins/${userId}`, { method: "DELETE" });
}
