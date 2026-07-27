"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  User as UserIcon,
  ShieldCheck,
  Warehouse,
  Globe,
  Activity,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/Card";
import { formatDateTime } from "@/lib/utils";
import { getUserActivity } from "@/features/admin/services/adminService";
import type { IamUserRead, UserActivityEntry, RoleRead } from "@/features/admin/types";
import type { Warehouse as WarehouseType } from "@/features/inventory/types";
import { AssignWarehouseModal } from "@/features/admin/components/AssignWarehouseModal";
import { RevokeWarehouseButton } from "@/features/admin/components/RevokeWarehouseButton";
import { EditUserModal } from "@/features/admin/components/EditUserModal";
import { DeleteUserButton } from "@/features/admin/components/DeleteUserButton";

interface Props {
  user: IamUserRead;
  roles: RoleRead[];
  warehouses: WarehouseType[];
}

function initials(email: string, username: string | null): string {
  const name = username || email;
  const parts = name.replace(/@.*/, "").split(/[.\-_ ]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
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

  const isDeleted = !!user.deleted_at;
  const label = user.username || user.email;
  const currentRole = user.roles[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-80"
        style={{ color: "var(--green-900)" }}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to users
      </Link>

      {/* ── Profile header ─────────────────────────────────────────── */}
      <div
        className="flex flex-col gap-5 rounded-xl sm:flex-row sm:items-center"
        style={{
          border: "1px solid var(--border-soft)",
          boxShadow: "var(--shadow)",
          background: "var(--surface-panel)",
        }}
      >
        {/* Avatar */}
        <div
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-2xl font-bold sm:h-24 sm:w-24 sm:text-3xl"
          style={{
            background: isDeleted ? "var(--bg-alt)" : "var(--green-900)",
            color: isDeleted ? "var(--ink-mute)" : "var(--ink-on-brand)",
          }}
        >
          {initials(user.email, user.username)}
        </div>

        {/* Info */}
        <div className="flex-1 space-y-1 pb-4 sm:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1
              className="text-xl font-semibold"
              style={{ color: "var(--ink)" }}
            >
              {label}
            </h1>
            {isDeleted ? (
              <Badge tone="red">
                Deleted {formatDateTime(user.deleted_at)}
              </Badge>
            ) : (
              <Badge tone="green">Active</Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--ink-soft)" }}>
            <Mail className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--ink-mute)" }} />
            {user.email}
          </div>

          {user.username && (
            <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--ink-soft)" }}>
              <UserIcon className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--ink-mute)" }} />
              {user.username}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isDeleted && (
          <div className="flex shrink-0 gap-2 px-5 pb-4 sm:px-0 sm:pr-5 sm:pb-0">
            <EditUserModal user={user} roles={roles} />
            <DeleteUserButton
              userId={user.id}
              username={user.username}
              email={user.email}
              isDeleted={isDeleted}
            />
          </div>
        )}
      </div>

      {/* ── Stats strip ────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            icon: <ShieldCheck className="h-4 w-4" />,
            label: "Role",
            value: currentRole ? currentRole.name : "None",
          },
          {
            icon: user.has_global_warehouse_access ? (
              <Globe className="h-4 w-4" />
            ) : (
              <Warehouse className="h-4 w-4" />
            ),
            label: user.has_global_warehouse_access
              ? "Global access"
              : "Warehouses",
            value: user.has_global_warehouse_access
              ? "All"
              : user.warehouse_assignments.length,
          },
          {
            icon: <Activity className="h-4 w-4" />,
            label: "Activity",
            value: loadingActivity ? "..." : activity.length,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
              border: "1px solid var(--border-soft)",
              background: "var(--surface-panel)",
            }}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "var(--green-050)", color: "var(--green-900)" }}
            >
              {stat.icon}
            </div>
            <div>
              <p
                className="text-lg font-semibold leading-tight"
                style={{ color: "var(--ink)" }}
              >
                {stat.value}
              </p>
              <p className="text-xs" style={{ color: "var(--ink-mute)" }}>
                {stat.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Warehouses ─────────────────────────────────────────────── */}
      <Card
        title="Warehouse Assignments"
        actions={
          !isDeleted && !user.has_global_warehouse_access ? (
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
            <Globe className="h-4 w-4" />
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
                {!isDeleted && (
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

      {/* ── Recent Activity ────────────────────────────────────────── */}
      <Card title="Recent Activity">
        {loadingActivity ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-mute)" }}>
            <Clock className="h-4 w-4 animate-spin" />
            Loading activity...
          </div>
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
