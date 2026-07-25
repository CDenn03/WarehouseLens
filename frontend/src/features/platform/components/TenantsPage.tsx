import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTime, formatNumber, getErrorMessage } from "@/lib/utils";
import { listTenants } from "@/features/platform/services/platformService";
import { CreateTenantModal } from "@/features/platform/components/CreateTenantModal";

export async function TenantsPage() {
  let tenants;
  try {
    tenants = await listTenants();
  } catch (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Tenants"
          description="Manage platform tenants"
        />
        <ErrorState message={getErrorMessage(error)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description={`${formatNumber(tenants.length)} tenant${tenants.length !== 1 ? "s" : ""} provisioned`}
        actions={<CreateTenantModal />}
      />

      {tenants.length === 0 ? (
        <Card>
          <p
            className="py-8 text-center text-sm"
            style={{ color: "var(--ink-mute)" }}
          >
            No tenants yet. Create the first one above.
          </p>
        </Card>
      ) : (
        <Card flush>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b text-left text-xs font-semibold uppercase tracking-wide"
                  style={{
                    borderColor: "var(--border-soft)",
                    color: "var(--ink-mute)",
                  }}
                >
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Superuser email</th>
                  <th className="px-5 py-3 text-right">Users</th>
                  <th className="px-5 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="border-b last:border-0 transition-colors hover:bg-[var(--bg-alt)]"
                    style={{ borderColor: "var(--border-soft)" }}
                  >
                    <td
                      className="px-5 py-3 font-medium"
                      style={{ color: "var(--ink)" }}
                    >
                      {tenant.name}
                    </td>
                    <td className="px-5 py-3" style={{ color: "var(--ink-mute)" }}>
                      {tenant.superuser_email ?? (
                        <span className="italic">not set</span>
                      )}
                    </td>
                    <td
                      className="px-5 py-3 text-right tabular-nums"
                      style={{ color: "var(--ink)" }}
                    >
                      {formatNumber(tenant.user_count)}
                    </td>
                    <td className="px-5 py-3" style={{ color: "var(--ink-mute)" }}>
                      {formatDateTime(tenant.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
