import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { formatNumber, getErrorMessage } from "@/lib/utils";
import { listTenants } from "@/features/platform/services/platformService";
import { TenantFormModal } from "@/features/platform/components/TenantFormModal";
import { TenantsTable } from "@/features/platform/components/TenantsTable";

export async function TenantsPage() {
  let tenants;
  try {
    tenants = await listTenants();
  } catch (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tenants" description="Manage platform tenants" />
        <ErrorState message={getErrorMessage(error)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description={`${formatNumber(tenants.length)} tenant${tenants.length !== 1 ? "s" : ""} provisioned`}
        actions={<TenantFormModal />}
      />

      <Card flush>
        <TenantsTable tenants={tenants} />
      </Card>
    </div>
  );
}
