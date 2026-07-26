import { PageHeader } from "@/components/PageHeader";
import { TenantsTableClient } from "@/features/platform/components/TenantsTableClient";

export async function TenantsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenants"
        description="Manage platform tenants"
      />

      <TenantsTableClient />
    </div>
  );
}
