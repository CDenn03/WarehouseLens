"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/Card";
import { Pagination } from "@/components/Pagination";
import { Table } from "@/components/Table";
import type { Column } from "@/components/Table";
import type { RoleDetailRead } from "@/features/admin/types";

interface Props {
  role: RoleDetailRead;
}

const CATEGORY_LABELS: Record<string, string> = {
  agent: "Agent",
  dashboard: "Dashboard",
  forecast: "Forecast",
  iam: "IAM",
  inventory: "Inventory",
  outbound: "Outbound",
  platform: "Platform",
  procurement: "Procurement",
  warehouse: "Warehouse",
};

const PAGE_SIZE = 10;

export function RoleDetailPageClient({ role }: Props) {
  const [permPage, setPermPage] = useState(1);
  const [userPage, setUserPage] = useState(1);

  const permTotalPages = Math.max(1, Math.ceil(role.permissions.length / PAGE_SIZE));
  const permSafePage = Math.min(permPage, permTotalPages);
  const permRows = role.permissions.slice((permSafePage - 1) * PAGE_SIZE, permSafePage * PAGE_SIZE);

  const userTotalPages = Math.max(1, Math.ceil(role.users.length / PAGE_SIZE));
  const userSafePage = Math.min(userPage, userTotalPages);
  const userRows = role.users.slice((userSafePage - 1) * PAGE_SIZE, userSafePage * PAGE_SIZE);

  const permissionColumns: Column<RoleDetailRead["permissions"][0]>[] = [
    {
      key: "id",
      header: "Permission",
      render: (p) => (
        <span className="font-mono text-xs" style={{ color: "var(--ink)" }}>
          {p.id}
        </span>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (p) => (
        <span style={{ color: "var(--ink-soft)" }}>{p.description}</span>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (p) => (
        <span
          className="rounded-full px-2 py-0.5 text-xs font-medium capitalize"
          style={{
            background: "var(--green-050)",
            color: "var(--green-900)",
          }}
        >
          {CATEGORY_LABELS[p.category] ?? p.category}
        </span>
      ),
    },
  ];

  const userColumns: Column<RoleDetailRead["users"][0]>[] = [
    {
      key: "username",
      header: "User",
      render: (u) => (
        <span className="font-medium" style={{ color: "var(--ink)" }}>
          {u.username || u.email}
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (u) => (
        <span style={{ color: "var(--ink-soft)" }}>{u.email}</span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (u) => (
        <Link href={`/admin/users/${u.id}`}>
          <ActionButton
            icon={<Eye className="h-4 w-4" style={{ color: "var(--ink-soft)" }} />}
            label="View user"
            onClick={() => {}}
          />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/roles"
          className="rounded-lg p-1.5 transition-colors hover:bg-brand-50"
          style={{ color: "var(--ink-soft)" }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <PageHeader
          title={role.name}
          description={`Slug: ${role.slug}`}
        />
      </div>

      <Card title={`Permissions (${role.permissions.length})`} flush>
        <Table
          columns={permissionColumns}
          rows={permRows}
          rowKey={(p) => p.id}
          emptyMessage="This role has no permissions assigned."
        />
        <Pagination
          page={permSafePage}
          totalPages={permTotalPages}
          total={role.permissions.length}
          onPageChange={setPermPage}
        />
      </Card>

      <Card title={`Users with this role (${role.users.length})`} flush>
        <Table
          columns={userColumns}
          rows={userRows}
          rowKey={(u) => u.id}
          emptyMessage="No users have this role."
        />
        <Pagination
          page={userSafePage}
          totalPages={userTotalPages}
          total={role.users.length}
          onPageChange={setUserPage}
        />
      </Card>
    </div>
  );
}
