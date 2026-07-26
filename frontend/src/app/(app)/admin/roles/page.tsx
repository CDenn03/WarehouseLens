import { ErrorState } from "@/components/ErrorState";
import { getErrorMessage } from "@/lib/utils";
import { listRoles, listUsers } from "@/features/admin/services/adminService";
import { AdminRolesPageClient } from "@/features/admin/components/AdminRolesPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  try {
    const [roles, users] = await Promise.all([listRoles(), listUsers()]);
    return <AdminRolesPageClient initialRoles={roles} initialUsers={users} />;
  } catch (error) {
    return <ErrorState message={getErrorMessage(error)} />;
  }
}
