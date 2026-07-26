"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { Table } from "@/components/Table";
import type { Column } from "@/components/Table";
import type { RoleRead, IamUserRead } from "@/features/admin/types";
import { CreateRoleModal } from "@/features/admin/components/CreateRoleModal";
import { EditRoleModal } from "@/features/admin/components/EditRoleModal";
import { DeleteRoleButton } from "@/features/admin/components/DeleteRoleButton";

interface Props {
  initialRoles: RoleRead[];
  initialUsers: IamUserRead[];
}

const SYSTEM_ROLES = new Set(["platform_admin", "tenant_admin"]);

export function AdminRolesPageClient({ initialRoles, initialUsers }: Props) {
  const [search, setSearch] = useState("");

  const filtered = initialRoles.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.slug.toLowerCase().includes(q)
    );
  });

  const columns: Column<RoleRead>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <Link
          href={`/admin/roles/${r.id}`}
          className="font-medium hover:underline"
          style={{ color: "var(--green-900)" }}
        >
          {r.name}
        </Link>
      ),
    },
    { key: "slug", header: "Slug", render: (r) => r.slug },
    {
      key: "users",
      header: "Users",
      className: "text-right",
      render: (r) => {
        const count = initialUsers.filter((u) =>
          u.roles.some((ur) => ur.slug === r.slug),
        ).length;
        return (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: "var(--green-050)", color: "var(--green-900)" }}
          >
            {count}
          </span>
        );
      },
    },
    {
      key: "type",
      header: "Type",
      render: (r) =>
        SYSTEM_ROLES.has(r.slug) ? (
          <span
            className="text-xs font-medium"
            style={{ color: "var(--ink-mute)" }}
          >
            System
          </span>
        ) : (
          <span
            className="text-xs font-medium"
            style={{ color: "var(--green-900)" }}
          >
            Custom
          </span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (r) => {
        const isSystem = SYSTEM_ROLES.has(r.slug);
        return (
          <div className="inline-flex items-center gap-0.5">
            <Link href={`/admin/roles/${r.id}`}>
              <ActionButton
                icon={<Eye className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />}
                label="View role"
                onClick={() => {}}
              />
            </Link>
            <EditRoleModal role={r} />
            <DeleteRoleButton
              roleId={r.id}
              roleName={r.name}
              disabled={isSystem}
              disabledReason={isSystem ? "System role cannot be deleted" : undefined}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles"
        description="Manage user roles and permissions"
        actions={<CreateRoleModal />}
      />

      <Card flush>
        <div
          className="flex items-center gap-4 border-b px-4 py-3"
          style={{ borderColor: "var(--border-soft)" }}
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search roles..."
            className="flex-1"
          />
        </div>
        <Table
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          emptyMessage={
            search ? `No roles match "${search}".` : "No roles found."
          }
        />
      </Card>
    </div>
  );
}
