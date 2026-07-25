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
