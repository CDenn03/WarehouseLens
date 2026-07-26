"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Warehouse, Activity } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { formatDateTime } from "@/lib/utils";
import { getUserActivity } from "@/features/admin/services/adminService";
import type { IamUserRead, UserActivityEntry } from "@/features/admin/types";
import type { Warehouse as WarehouseType } from "@/features/inventory/types";
import { AssignRoleModal } from "@/features/admin/components/AssignRoleModal";
import { AssignWarehouseModal } from "@/features/admin/components/AssignWarehouseModal";
import { RevokeRoleButton } from "@/features/admin/components/RevokeRoleButton";
import { RevokeWarehouseButton } from "@/features/admin/components/RevokeWarehouseButton";

interface Props {
  user: IamUserRead;
  roles: IamUserRead["roles"];
  warehouses: WarehouseType[];
}

export function UserProfilePage({ user, roles, warehouses }: Props) {
  const [activity, setActivity] = useState<UserActivityEntry[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    setLoadingActivity(true);
    getUserActivity(user.id, 20)
      .then(setActivity)
      .catch(() => setActivity([]))
      .finally(() => setLoadingActivity(false));
  }, [user.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/users"
          className="rounded-lg p-1.5 transition-colors hover:bg-brand-50"
          style={{ color: "var(--ink-soft)" }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <PageHeader
          title={user.username || user.email}
          description={user.email}
          actions={
            user.deleted_at ? (
              <Badge tone="red">
                Deleted {formatDateTime(user.deleted_at)}
              </Badge>
            ) : undefined
          }
        />
      </div>

      {/* Roles */}
      <Card
        title="Roles"
        actions={
          !user.deleted_at ? (
            <AssignRoleModal user={user} roles={roles} />
          ) : undefined
        }
      >
        {user.roles.length === 0 ? (
          <p className="text-sm italic" style={{ color: "var(--ink-mute)" }}>
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
      </Card>

      {/* Warehouses */}
      <Card
        title="Warehouse Assignments"
        actions={
          !user.deleted_at && !user.has_global_warehouse_access ? (
            <AssignWarehouseModal user={user} warehouses={warehouses} />
          ) : undefined
        }
      >
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
          <p className="text-sm italic" style={{ color: "var(--ink-mute)" }}>
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
      </Card>

      {/* Recent Activity */}
      <Card title="Recent Activity">
        {loadingActivity ? (
          <p className="text-sm italic" style={{ color: "var(--ink-mute)" }}>
            Loading...
          </p>
        ) : activity.length === 0 ? (
          <p className="text-sm italic" style={{ color: "var(--ink-mute)" }}>
            No recent activity
          </p>
        ) : (
          <ul className="space-y-2">
            {activity.map((entry, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-2 text-sm"
              >
                <span style={{ color: "var(--ink)" }}>
                  <span
                    className="font-medium"
                    style={{
                      color: entry.kind.includes("assigned")
                        ? "var(--green-900)"
                        : "var(--error)",
                    }}
                  >
                    {entry.kind.replace("_", " ")}
                  </span>{" "}
                  {entry.target}
                </span>
                <span
                  className="shrink-0 text-xs"
                  style={{ color: "var(--ink-mute)" }}
                >
                  {formatDateTime(entry.occurred_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
