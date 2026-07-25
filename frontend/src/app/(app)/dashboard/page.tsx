/**
 * /dashboard — role-dispatch entry point.
 *
 * Reads the current user's roles and redirects:
 *   platform_admin  → /platform   (platform dashboard)
 *   anything else   → stays here  (operational dashboard)
 *
 * The redirect happens server-side before any content is sent to the browser,
 * so there is no flash of wrong content.
 */
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import type { IamUserRead } from "@/features/admin/types";

export const dynamic = "force-dynamic";

async function resolveRole(sub: string): Promise<"platform_admin" | "tenant"> {
  try {
    const user = await apiFetch<IamUserRead>(`/iam/users/${sub}`);
    if (user.roles.some((r) => r.slug === "platform_admin")) {
      return "platform_admin";
    }
  } catch {
    // Any error (403 if they're a platform admin without an IAM tenant,
    // 404, network) — fall through to operational dashboard.
  }
  return "tenant";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ warehouse_id?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/signin");

  const role = await resolveRole(session.user.sub);
  if (role === "platform_admin") {
    redirect("/platform");
  }

  const { warehouse_id } = await searchParams;
  return <DashboardPage warehouseId={warehouse_id} />;
}
