import { ErrorState } from "@/components/ErrorState";
import { getErrorMessage } from "@/lib/utils";
import { getRoleDetail } from "@/features/admin/services/adminService";
import { RoleDetailPageClient } from "@/features/admin/components/RoleDetailPageClient";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ roleId: string }>;
}) {
  const { roleId } = await params;
  try {
    const role = await getRoleDetail(roleId);
    return <RoleDetailPageClient role={role} />;
  } catch (error) {
    return <ErrorState message={getErrorMessage(error)} />;
  }
}
