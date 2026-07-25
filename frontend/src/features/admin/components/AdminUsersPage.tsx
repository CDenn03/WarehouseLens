import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTime, getErrorMessage } from "@/lib/utils";
import { getWarehouses } from "@/features/inventory/services/inventoryService";
import type { Warehouse } from "@/features/inventory/types";
import {
  listRoles,
  listUsers,
} from "@/features/admin/services/adminService";
import type { IamUserRead, RoleRead } from "@/features/admin/types";
import { AssignRoleModal } from "@/features/admin/components/AssignRoleModal";
import { AssignWarehouseModal } from "@/features/admin/components/AssignWarehouseModal";
import { RevokeRoleButton } from "@/features/admin/components/RevokeRoleButton";
import { RevokeWarehouseButton } from "@/features/admin/components/RevokeWarehouseButton";

export async function AdminUsersPage() {
  let users: IamUserRead[];
  let roles: RoleRead[];
  let warehouses: Warehouse[];
  try {
    [users, roles, warehouses] = await Promise.all([
      listUsers(),
      listRoles(),
      getWarehouses(),
    ]);
  } catch (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="User Administration"
          description="Manage user roles and warehouse assignments"
        />
        <ErrorState message={getErrorMessage(error)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Administration"
        description="Manage user roles and warehouse assignments"
      />

      <div className="space-y-4">
        {users.map((user) => (
          <Card key={user.id}>
            {/* ── User header row ── */}
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3
                    className="text-base font-semibold"
                    style={{ color: "var(--ink)" }}
                  >
                    {user.username || user.email}
                  </h3>
                  {user.deleted_at && <Badge tone="red">Deleted</Badge>}
                </div>
                <p
                  className="mt-0.5 text-sm"
                  style={{ color: "var(--ink-mute)" }}
                >
                  {user.email}
                </p>
                {user.deleted_at && (
                  <p
                    className="mt-1 text-xs"
                    style={{ color: "var(--ink-mute)" }}
                  >
                    Deleted {formatDateTime(user.deleted_at)}
                  </p>
                )}
              </div>
            </div>

            {/* ── Roles section ── */}
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ink-mute)" }}
                >
                  Roles
                </span>
                {!user.deleted_at && (
                  <AssignRoleModal user={user} roles={roles} />
                )}
              </div>
              {user.roles.length === 0 ? (
                <p
                  className="text-sm italic"
                  style={{ color: "var(--ink-mute)" }}
                >
                  No roles assigned
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {user.roles.map((role) => (
                    <div
                      key={role.slug}
                      className="flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1"
                      style={{
                        background: "var(--green-050)",
                        border: "1px solid var(--green-100)",
                      }}
                    >
                      <span
                        className="text-xs font-medium"
                        style={{ color: "var(--green-900)" }}
                      >
                        {role.name}
                      </span>
                      {!user.deleted_at && (
                        <RevokeRoleButton userId={user.id} roleSlug={role.slug} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Warehouses section ── */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ink-mute)" }}
                >
                  Warehouse Assignments
                </span>
                {!user.deleted_at && (
                  <AssignWarehouseModal user={user} warehouses={warehouses} />
                )}
              </div>
              {user.has_global_warehouse_access ? (
                <div
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: "var(--green-900)",
                    color: "var(--ink-on-brand)",
                  }}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
                    />
                  </svg>
                  Global warehouse access — bypasses assignment list
                </div>
              ) : user.warehouse_assignments.length === 0 ? (
                <p
                  className="text-sm italic"
                  style={{ color: "var(--ink-mute)" }}
                >
                  No warehouses assigned
                </p>
              ) : (
                <div className="space-y-1.5">
                  {user.warehouse_assignments.map((assignment) => (
                    <div
                      key={assignment.warehouse_id}
                      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                      style={{
                        background: "var(--bg-alt)",
                        border: "1px solid var(--border-soft)",
                      }}
                    >
                      <div>
                        <p
                          className="text-sm font-medium"
                          style={{ color: "var(--ink)" }}
                        >
                          {assignment.warehouse_name}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: "var(--ink-mute)" }}
                        >
                          Assigned {formatDateTime(assignment.assigned_at)}
                        </p>
                      </div>
                      {!user.deleted_at && (
                        <RevokeWarehouseButton
                          userId={user.id}
                          warehouseId={assignment.warehouse_id}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
