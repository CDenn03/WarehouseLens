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
import type { IamUserRead, RoleRead } from "@/features/admin/types";
import type { Warehouse } from "@/features/inventory/types";
import { CreateUserModal } from "@/features/admin/components/CreateUserModal";
import { EditUserModal } from "@/features/admin/components/EditUserModal";
import { DeleteUserButton } from "@/features/admin/components/DeleteUserButton";

interface Props {
  initialUsers: IamUserRead[];
  roles: RoleRead[];
  warehouses: Warehouse[];
}

export function AdminUsersPageClient({
  initialUsers,
  roles,
  warehouses,
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = initialUsers.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.username ?? "").toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.roles.some((r) => r.name.toLowerCase().includes(q))
    );
  });

  const columns: Column<IamUserRead>[] = [
    {
      key: "username",
      header: "Username",
      render: (u) => (
        <span className="font-medium" style={{ color: "var(--ink)" }}>
          {u.username || u.email}
        </span>
      ),
    },
    { key: "email", header: "Email", render: (u) => u.email },
    {
      key: "roles",
      header: "Roles",
      render: (u) =>
        u.roles.length === 0 ? (
          <span className="italic" style={{ color: "var(--ink-mute)" }}>
            None
          </span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {u.roles.map((r) => (
              <span
                key={r.slug}
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  background: "var(--green-050)",
                  color: "var(--green-900)",
                }}
              >
                {r.name}
              </span>
            ))}
          </div>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (u) =>
        u.deleted_at ? (
          <span
            className="text-xs font-medium"
            style={{ color: "var(--error)" }}
          >
            Deleted
          </span>
        ) : (
          <span
            className="text-xs font-medium"
            style={{ color: "var(--green-900)" }}
          >
            Active
          </span>
        ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (u) => (
        <div className="inline-flex items-center gap-0.5">
          <Link href={`/admin/users/${u.id}`}>
            <ActionButton
              icon={
                <Eye className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />
              }
              label="View profile"
              onClick={() => {}}
            />
          </Link>
          <EditUserModal user={u} roles={roles} />
          <DeleteUserButton
            userId={u.id}
            username={u.username}
            email={u.email}
            isDeleted={!!u.deleted_at}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage user roles and warehouse assignments"
        actions={<CreateUserModal roles={roles} />}
      />

      <Card flush>
        <div
          className="flex items-center gap-4 border-b px-4 py-3"
          style={{ borderColor: "var(--border-soft)" }}
        >
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search users..."
            className="flex-1"
          />
        </div>
        <Table
          columns={columns}
          rows={filtered}
          rowKey={(u) => u.id}
          emptyMessage={
            search ? `No users match "${search}".` : "No users found."
          }
        />
      </Card>
    </div>
  );
}
