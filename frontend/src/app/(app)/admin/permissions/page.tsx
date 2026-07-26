import { ErrorState } from "@/components/ErrorState";
import { getErrorMessage } from "@/lib/utils";
import { listPermissions } from "@/features/admin/services/adminService";
import { PermissionsPageClient } from "@/features/admin/components/PermissionsPageClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  try {
    const permissions = await listPermissions();
    return <PermissionsPageClient initialPermissions={permissions} />;
  } catch (error) {
    return <ErrorState message={getErrorMessage(error)} />;
  }
}
