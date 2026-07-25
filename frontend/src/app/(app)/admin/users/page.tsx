import { AdminUsersPage } from "@/features/admin/components/AdminUsersPage";

// User data must always be fetched fresh — never prerender.
export const dynamic = "force-dynamic";

export default function Page() {
  return <AdminUsersPage />;
}
