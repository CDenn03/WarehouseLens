import { Card } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { PageHeader } from "@/components/PageHeader";
import { getErrorMessage } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import { listPlatformAdmins } from "@/features/platform/services/platformService";
import { PlatformAdminsList } from "@/features/platform/components/PlatformAdminsList";

export async function PlatformAdminsPage() {
  let admins;
  let currentUserId = "";

  try {
    const session = await getSession();
    currentUserId = session?.user.sub ?? "";
    admins = await listPlatformAdmins();
  } catch (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Platform Admins"
          description="Manage platform administrator users"
        />
        <ErrorState message={getErrorMessage(error)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Admins"
        description="Users with platform-wide administrative access"
      />

      <Card title="Platform administrators" description="Users with the platform_admin role">
        <PlatformAdminsList admins={admins} currentUserId={currentUserId} />
      </Card>
    </div>
  );
}
