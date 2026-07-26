import { formatDateTime, formatNumber } from "@/lib/utils";
import { TenantRowActions } from "@/features/platform/components/TenantRowActions";
import type { TenantRead } from "@/features/platform/types";

interface Props {
  tenants: TenantRead[];
  /** Hide per-row actions where the table is a read-only summary. */
  showActions?: boolean;
}

export function TenantsTable({ tenants, showActions = true }: Props) {
  if (tenants.length === 0) {
    return (
      <p
        className="px-5 py-8 text-center text-sm"
        style={{ color: "var(--ink-mute)" }}
      >
        No tenants yet. Create the first one above.
      </p>
    );
  }

  return (
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
            <th className="px-5 py-3">Admin email</th>
            <th className="px-5 py-3 text-right">Users</th>
            <th className="px-5 py-3 text-right">Warehouses</th>
            <th className="px-5 py-3">Created</th>
            {showActions && <th className="px-5 py-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <tr
              key={tenant.id}
              className="border-b last:border-0 transition-colors hover:bg-[var(--bg-alt)]"
              style={{ borderColor: "var(--border-soft)" }}
            >
              <td className="px-5 py-3 font-medium" style={{ color: "var(--ink)" }}>
                {tenant.name}
              </td>
              <td className="px-5 py-3" style={{ color: "var(--ink-mute)" }}>
                {tenant.admin_email ?? <span className="italic">not set</span>}
              </td>
              <td
                className="px-5 py-3 text-right tabular-nums"
                style={{ color: "var(--ink)" }}
              >
                {formatNumber(tenant.user_count)}
              </td>
              <td
                className="px-5 py-3 text-right tabular-nums"
                style={{ color: "var(--ink)" }}
              >
                {formatNumber(tenant.warehouse_count)}
              </td>
              <td className="px-5 py-3" style={{ color: "var(--ink-mute)" }}>
                {formatDateTime(tenant.created_at)}
              </td>
              {showActions && (
                <td className="px-5 py-3">
                  <TenantRowActions tenant={tenant} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
