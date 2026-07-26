import { ErrorState } from "@/components/ErrorState";
import { getErrorMessage } from "@/lib/utils";
import { getWarehouses } from "@/features/inventory/services/inventoryService";
import {
  listRoles,
  listUsers,
} from "@/features/admin/services/adminService";
import { AdminUsersPageClient } from "@/features/admin/components/AdminUsersPage";

export const dynamic = "force-dynamic";

export default async function Page() {
  try {
    const [users, roles, warehouses] = await Promise.all([
      listUsers(),
      listRoles(),
      getWarehouses(),
    ]);
    return (
      <AdminUsersPageClient
        initialUsers={users}
        roles={roles}
        warehouses={warehouses}
      />
    );
  } catch (error) {
    return <ErrorState message={getErrorMessage(error)} />;
  }
}
