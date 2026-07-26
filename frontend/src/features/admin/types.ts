/** Types for the IAM admin feature — mirrors app/schemas/iam.py. */

export interface RoleRead {
  id: string;
  slug: string;
  name: string;
}

export interface WarehouseAssignmentRead {
  warehouse_id: string;
  warehouse_name: string;
  assigned_at: string;
}

export interface IamUserRead {
  id: string;
  email: string;
  username: string | null;
  deleted_at: string | null;
  roles: RoleRead[];
  warehouse_assignments: WarehouseAssignmentRead[];
  /** True if the user holds warehouse.global — show "Global access" instead
   * of the (possibly empty) warehouse assignment list. */
  has_global_warehouse_access: boolean;
}

export interface UserActivityEntry {
  kind: "role_assigned" | "role_revoked" | "warehouse_assigned" | "warehouse_revoked";
  target: string;
  actor_label: string;
  occurred_at: string;
}

export interface PermissionRead {
  id: string;
  description: string;
  category: string;
}

export interface RoleDetailUser {
  id: string;
  email: string;
  username: string | null;
}

export interface RoleDetailRead {
  id: string;
  slug: string;
  name: string;
  permissions: PermissionRead[];
  users: RoleDetailUser[];
}

/** Tenant administration dashboard — mirrors app/schemas/dashboard.py. */
export interface TenantActivityEntry {
  kind: "role" | "warehouse";
  user_label: string;
  target: string;
  occurred_at: string;
}

export interface TenantDashboardSummary {
  user_count: number;
  role_count: number;
  warehouse_count: number;
  recent_activity: TenantActivityEntry[];
}
