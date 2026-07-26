import Link from "next/link";
import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { formatDateTime, formatNumber, getErrorMessage } from "@/lib/utils";
import { getTenantSummary } from "@/features/admin/services/tenantDashboardService";
import type {
  TenantActivityEntry,
  TenantDashboardSummary,
} from "@/features/admin/types";

const iconClass = "h-5 w-5";

const usersIcon = (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>
);

const rolesIcon = (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
  </svg>
);

const warehousesIcon = (
  <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5M3.75 21V9.349m16.5 11.651V9.349M12 3L3.75 9.349m16.5 0L12 3m0 0v18M7.5 12h3m3 0h3" />
  </svg>
);

function ActivityRow({ entry }: { entry: TenantActivityEntry }) {
  const verb = entry.kind === "role" ? "granted" : "assigned to";
  return (
    <li className="flex items-start justify-between gap-4 px-5 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" style={{ color: "var(--ink)" }}>
          {entry.user_label}
        </p>
        <p className="mt-0.5 text-xs" style={{ color: "var(--ink-mute)" }}>
          {verb} <span className="font-medium">{entry.target}</span>
        </p>
      </div>
      <time
        className="shrink-0 text-xs tabular-nums"
        style={{ color: "var(--ink-mute)" }}
        dateTime={entry.occurred_at}
      >
        {formatDateTime(entry.occurred_at)}
      </time>
    </li>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--bg-alt)]"
      style={{ border: "1px solid var(--border-soft)", color: "var(--ink-soft)" }}
    >
      {label}
    </Link>
  );
}

export async function TenantDashboardPage() {
  let summary: TenantDashboardSummary;

  try {
    summary = await getTenantSummary();
  } catch (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Tenant administration"
          description="Users, roles and warehouses in your organization"
        />
        <ErrorState message={getErrorMessage(error)} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tenant administration"
        description="Users, roles and warehouses in your organization"
        actions={
          <>
            <QuickLink href="/admin/users" label="Manage users" />
            <QuickLink href="/admin/roles" label="Manage roles" />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Users"
          value={formatNumber(summary.user_count)}
          hint="Active members of this tenant"
          icon={usersIcon}
        />
        <StatCard
          label="Roles in use"
          value={formatNumber(summary.role_count)}
          hint="Distinct roles currently assigned"
          icon={rolesIcon}
        />
        <StatCard
          label="Warehouses"
          value={formatNumber(summary.warehouse_count)}
          hint="Sites in this tenant"
          icon={warehousesIcon}
        />
      </div>

      <Card
        title="Recent activity"
        description="Latest role and warehouse assignments"
        flush
      >
        {summary.recent_activity.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--ink-mute)" }}>
            No assignments yet. Grant a user a role to get started.
          </p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border-soft)" }}>
            {summary.recent_activity.map((entry) => (
              <ActivityRow
                key={`${entry.kind}-${entry.user_label}-${entry.target}-${entry.occurred_at}`}
                entry={entry}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
