import { PageHeader } from "@/components/PageHeader";
import { getSession } from "@/lib/auth";
import { PlatformAdminsClient } from "@/features/platform/components/PlatformAdminsClient";

export async function PlatformAdminsPage() {
  const session = await getSession();
  const currentUserId = session?.user.sub ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Admins"
        description="Users with platform-wide administrative access"
      />

      <PlatformAdminsClient currentUserId={currentUserId} />
    </div>
  );
}
