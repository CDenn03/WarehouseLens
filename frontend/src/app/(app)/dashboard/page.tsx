import { DashboardPage } from "@/features/dashboard/components/DashboardPage";

// Operational data must always be fetched fresh — never prerender at build time.
export const dynamic = "force-dynamic";

export default function Page({
  searchParams,
}: {
  searchParams: { warehouse_id?: string };
}) {
  return <DashboardPage warehouseId={searchParams.warehouse_id} />;
}
