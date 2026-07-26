import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { formatNumber, getErrorMessage } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import {
  listPlatformAdmins,
  listTenants,
} from "@/features/platform/services/platformService";
import type { PlatformAdminRead, TenantRead } from "@/features/platform/types";
import { PlatformAdminFormModal } from "@/features/platform/components/PlatformAdminFormModal";
import { PlatformAdminsList } from "@/features/platform/components/PlatformAdminsList";
import { TenantFormModal } from "@/features/platform/components/TenantFormModal";
import { TenantsTable } from "@/features/platform/components/TenantsTable";

export async function PlatformDashboardPage() {
  let tenants: TenantRead[];
  let admins: PlatformAdminRead[];
  let currentUserId = "";

  try {
    const session = await getSession();
    currentUserId = session?.user.sub ?? "";
    const [tenantResult, adminResult] = await Promise.all([
      listTenants(),
      listPlatformAdmins(),
    ]);
    tenants = tenantResult.items;
    admins = adminResult.items;
  } catch (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Platform" description="Tenant and platform admin management" />
        <ErrorState message={getErrorMessage(error)} />
      </div>
    );
  }

  const totalUsers = tenants.reduce((s, t) => s + t.user_count, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform"
        description="Manage tenants and platform administrators"
        actions={<TenantFormModal />}
      />

      {/* ── Summary KPIs ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Tenants",
            value: formatNumber(tenants.length),
            hint: "Active tenants on this platform",
            icon: (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5M3.75 21V9.349m16.5 11.651V9.349M12 3L3.75 9.349m16.5 0L12 3m0 0v18M7.5 12h3m3 0h3" />
              </svg>
            ),
          },
          {
            label: "Total users",
            value: formatNumber(totalUsers),
            hint: "Across all tenants",
            icon: (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            ),
          },
          {
            label: "Platform admins",
            value: formatNumber(admins.length),
            hint: "Users with platform_admin role",
            icon: (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            ),
          },
          {
            label: "Avg users/tenant",
            value: tenants.length > 0 ? String(Math.round(totalUsers / tenants.length)) : "0",
            hint: "Platform utilization",
            icon: (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            ),
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl p-5"
            style={{
              background: "var(--panel)",
              border: "1px solid var(--border-soft)",
              boxShadow: "var(--shadow)",
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{
                  background: "var(--green-050)",
                  color: "var(--green-900)",
                }}
              >
                {kpi.icon}
              </span>
              <div>
                <p
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: "var(--ink-mute)" }}
                >
                  {kpi.label}
                </p>
                <p
                  className="text-2xl font-bold tabular-nums"
                  style={{ color: "var(--green-900)" }}
                >
                  {kpi.value}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--ink-mute)" }}>
              {kpi.hint}
            </p>
          </div>
        ))}
      </div>

      {/* ── Tenants table + admins ── */}
      <div className="grid gap-6 xl:grid-cols-3">
        {/* Tenants table — 2/3 width */}
        <div className="xl:col-span-2">
          <Card title="Tenants" description="All provisioned tenants" flush>
            <TenantsTable tenants={tenants} />
          </Card>
        </div>

        {/* Platform admins — 1/3 width */}
        <div>
          <Card
            title="Platform admins"
            description="Users with platform_admin role"
            actions={<PlatformAdminFormModal />}
          >
            <PlatformAdminsList admins={admins} currentUserId={currentUserId} />
          </Card>
        </div>
      </div>
    </div>
  );
}
