import { apiFetch } from "@/lib/api";
import type {
  IamUserRead,
  PermissionRead,
  RoleDetailRead,
  RoleRead,
  UserActivityEntry,
} from "@/features/admin/types";

// ── Users ───────────────────────────────────────────────────────────────

export function listUsers(
  includeDeleted = false,
  search?: string,
): Promise<IamUserRead[]> {
  return apiFetch<IamUserRead[]>("/iam/users", {
    query: {
      include_deleted: includeDeleted,
      ...(search ? { search } : {}),
    },
  });
}

export function getUser(userId: string): Promise<IamUserRead> {
  return apiFetch<IamUserRead>(`/iam/users/${userId}`);
}

export function createUser(
  email: string,
  username?: string,
): Promise<IamUserRead> {
  return apiFetch<IamUserRead>("/iam/users", {
    method: "POST",
    body: { email, ...(username ? { username } : {}) },
  });
}

export function updateUser(
  userId: string,
  data: { email?: string; username?: string },
): Promise<IamUserRead> {
  return apiFetch<IamUserRead>(`/iam/users/${userId}`, {
    method: "PATCH",
    body: data,
  });
}

export function deleteUser(userId: string): Promise<void> {
  return apiFetch<void>(`/iam/users/${userId}`, { method: "DELETE" });
}

export function getUserActivity(
  userId: string,
  limit = 20,
): Promise<UserActivityEntry[]> {
  return apiFetch<UserActivityEntry[]>(`/iam/users/${userId}/activity`, {
    query: { limit },
  });
}

// ── Roles ───────────────────────────────────────────────────────────────

export function listRoles(search?: string): Promise<RoleRead[]> {
  return apiFetch<RoleRead[]>("/iam/roles", {
    query: search ? { search } : {},
  });
}

export function getRoleDetail(roleId: string): Promise<RoleDetailRead> {
  return apiFetch<RoleDetailRead>(`/iam/roles/${roleId}`);
}

export function createRole(
  name: string,
  slug?: string,
  permissionIds?: string[],
): Promise<RoleRead> {
  return apiFetch<RoleRead>("/iam/roles", {
    method: "POST",
    body: {
      name,
      ...(slug ? { slug } : {}),
      ...(permissionIds && permissionIds.length > 0 ? { permission_ids: permissionIds } : {}),
    },
  });
}

export function updateRole(
  roleId: string,
  data: { name?: string; permissionIds?: string[] },
): Promise<RoleRead> {
  return apiFetch<RoleRead>(`/iam/roles/${roleId}`, {
    method: "PATCH",
    body: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.permissionIds !== undefined ? { permission_ids: data.permissionIds } : {}),
    },
  });
}

export function deleteRole(roleId: string): Promise<void> {
  return apiFetch<void>(`/iam/roles/${roleId}`, { method: "DELETE" });
}

// ── Permissions ─────────────────────────────────────────────────────────

export function listPermissions(): Promise<PermissionRead[]> {
  return apiFetch<PermissionRead[]>("/iam/permissions");
}

// ── Role assignment ─────────────────────────────────────────────────────

export function assignRole(
  userId: string,
  roleSlug: string,
): Promise<IamUserRead> {
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

// ── Warehouse assignment ────────────────────────────────────────────────

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
