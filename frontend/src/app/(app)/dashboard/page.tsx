/**
 * /dashboard — permission-dispatch entry point.
 *
 * The backend resolves which dashboard the caller gets from their `dashboard.*`
 * permissions and returns it as `me.dashboard`; this page redirects there.
 * "operations" is this page itself, so that case falls through and renders.
 *
 * The redirect happens server-side before any content is sent to the browser,
 * so there is no flash of wrong content.
 */
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DASHBOARD_ROUTES, getMe } from "@/lib/dashboards";
import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import { NoDashboardState } from "@/components/NoDashboardState";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ warehouse_id?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/signin");

  const me = await getMe(session.accessToken);

  // No dashboard permission at all — say so, rather than rendering a page whose
  // every request will 403.
  if (!me?.dashboard) return <NoDashboardState />;

  if (me.dashboard !== "operations") {
    redirect(DASHBOARD_ROUTES[me.dashboard]);
  }

  const { warehouse_id } = await searchParams;
  return <DashboardPage warehouseId={warehouse_id} />;
}
