import { ErrorState } from "@/components/ErrorState";
import { getErrorMessage } from "@/lib/utils";
import { getWarehouses } from "@/features/inventory/services/inventoryService";
import { listRoles, getUser } from "@/features/admin/services/adminService";
import { UserProfilePage } from "@/features/admin/components/UserProfilePage";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  try {
    const [user, roles, warehouses] = await Promise.all([
      getUser(userId),
      listRoles(),
      getWarehouses(),
    ]);
    return (
      <UserProfilePage user={user} roles={roles} warehouses={warehouses} />
    );
  } catch (error) {
    return <ErrorState message={getErrorMessage(error)} />;
  }
}
