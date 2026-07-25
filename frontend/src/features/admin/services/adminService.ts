import { apiFetch } from "@/lib/api";
import type { IamUserRead, RoleRead } from "@/features/admin/types";

export function listUsers(includeDeleted = false): Promise<IamUserRead[]> {
  return apiFetch<IamUserRead[]>("/iam/users", {
    query: { include_deleted: includeDeleted },
  });
}

export function getUser(userId: string): Promise<IamUserRead> {
  return apiFetch<IamUserRead>(`/iam/users/${userId}`);
}

export function listRoles(): Promise<RoleRead[]> {
  return apiFetch<RoleRead[]>("/iam/roles");
}

export function assignRole(userId: string, roleSlug: string): Promise<IamUserRead> {
  return apiFetch<IamUserRead>(`/iam/users/${userId}/roles`, {
    method: "POST",
    body: { role_slug: roleSlug },
  });
}

export function revokeRole(userId: string, roleSlug: string): Promise<void> {
  return apiFetch<void>(`/iam/users/${userId}/roles/${roleSlug}`, {
    method: "DELETE",
  });
}

export function assignWarehouse(
  userId: string,
  warehouseId: string,
): Promise<IamUserRead> {
  return apiFetch<IamUserRead>(`/iam/users/${userId}/warehouses`, {
    method: "POST",
    body: { warehouse_id: warehouseId },
  });
}

export function revokeWarehouse(
  userId: string,
  warehouseId: string,
): Promise<void> {
  return apiFetch<void>(`/iam/users/${userId}/warehouses/${warehouseId}`, {
    method: "DELETE",
  });
}
